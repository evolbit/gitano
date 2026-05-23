use super::external_agents::{external_agent_command, external_agent_status};
use super::types::{
    ExternalAiAgentConfigOption, ExternalAiAgentConfigOptionValue, ExternalAiAgentSessionConfig,
    ExternalAiAgentSessionConfigRequest, ExternalAiAgentStatusState, ExternalAiPromptRequest,
    ExternalAiPromptResponse, ExternalAiRunEvent, ExternalAiRunEventKind, LocalAiActionKind,
    LocalAiRunProgress, LocalAiRunProgressState, EXTERNAL_AI_RUN_EVENT,
    LOCAL_AI_RUN_PROGRESS_EVENT,
};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const ACP_PROTOCOL_VERSION: u16 = 1;
const JSON_RPC_VERSION: &str = "2.0";
const DEFAULT_TERMINAL_OUTPUT_LIMIT: usize = 256_000;
const MAX_TERMINAL_OUTPUT_LIMIT: usize = 1_048_576;
const EXTERNAL_AGENT_IDLE_TIMEOUT: Duration = Duration::from_secs(90);
const SANITIZED_GIT_CONFIG_ARGS: &[&str] = &[
    "-c",
    "diff.external=",
    "-c",
    "core.pager=cat",
    "-c",
    "color.ui=false",
];

static ACTIVE_RUNS: Lazy<Mutex<HashMap<String, ActiveRun>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
struct ActiveRun {
    session_id: Option<String>,
    writer: Arc<Mutex<ChildStdin>>,
}

#[derive(Debug, Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

#[derive(Debug, Deserialize)]
struct RpcMessage {
    #[serde(default)]
    id: Option<Value>,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    params: Option<Value>,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<RpcError>,
}

struct AcpProcessClient {
    app: AppHandle,
    request: ExternalAiPromptRequest,
    repo_root: PathBuf,
    child: Child,
    writer: Arc<Mutex<ChildStdin>>,
    stdout_lines: Receiver<Result<String, String>>,
    next_request_id: u64,
    next_terminal_id: u64,
    terminals: HashMap<String, TerminalSession>,
    transcript: String,
}

struct TerminalSession {
    child: Child,
    output: Arc<Mutex<TerminalOutput>>,
}

#[derive(Default)]
struct TerminalOutput {
    text: String,
    truncated: bool,
}

struct PreparedTerminalCommand {
    program: String,
    args: Vec<String>,
    display: String,
}

struct AcpSession {
    session_id: String,
    config_options: Vec<ExternalAiAgentConfigOption>,
    mode_config_fallback: bool,
}

impl Drop for AcpProcessClient {
    fn drop(&mut self) {
        unregister_active_run(&self.request.run_id);
        for terminal in self.terminals.values_mut() {
            let _ = terminal.child.kill();
            let _ = terminal.child.wait();
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub async fn run_external_agent_prompt(
    app: AppHandle,
    request: ExternalAiPromptRequest,
) -> Result<ExternalAiPromptResponse, String> {
    tauri::async_runtime::spawn_blocking(move || run_external_agent_prompt_blocking(app, request))
        .await
        .map_err(|e| e.to_string())?
}

pub async fn get_external_agent_session_config(
    app: AppHandle,
    request: ExternalAiAgentSessionConfigRequest,
) -> Result<ExternalAiAgentSessionConfig, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_external_agent_session_config_blocking(app, request)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn cancel_external_agent_run(run_id: &str) -> Result<(), String> {
    let run = {
        let runs = ACTIVE_RUNS.lock().map_err(|e| e.to_string())?;
        runs.get(run_id.trim()).cloned()
    }
    .ok_or_else(|| format!("External agent run is not active: {}", run_id))?;

    let session_id = run
        .session_id
        .ok_or_else(|| "External agent session is not ready for cancellation.".to_string())?;
    write_message(
        &run.writer,
        &json!({
            "jsonrpc": JSON_RPC_VERSION,
            "method": "session/cancel",
            "params": {
                "sessionId": session_id,
            }
        }),
    )
}

fn get_external_agent_session_config_blocking(
    app: AppHandle,
    request: ExternalAiAgentSessionConfigRequest,
) -> Result<ExternalAiAgentSessionConfig, String> {
    let status = external_agent_status(&request.agent_id)?;
    if status.state != ExternalAiAgentStatusState::Ready || !status.available {
        return Err(status
            .error
            .unwrap_or_else(|| format!("External agent {} is not ready.", request.agent_id)));
    }

    let repo_path = external_agent_config_probe_cwd(request.repo_path.as_deref())?;
    let prompt_request = ExternalAiPromptRequest {
        agent_id: request.agent_id.clone(),
        repo_path,
        run_id: format!("external-agent-config-{}", request.agent_id),
        action_kind: LocalAiActionKind::BranchAnalysis,
        prompt: String::new(),
        external_agent_option_overrides: HashMap::new(),
    };
    let mut client = AcpProcessClient::start(app, prompt_request)?;
    client.initialize()?;
    let session = client.create_session()?;

    Ok(ExternalAiAgentSessionConfig {
        agent_id: request.agent_id,
        options: session.config_options,
    })
}

fn run_external_agent_prompt_blocking(
    app: AppHandle,
    request: ExternalAiPromptRequest,
) -> Result<ExternalAiPromptResponse, String> {
    let status = external_agent_status(&request.agent_id)?;
    if status.state != ExternalAiAgentStatusState::Ready || !status.available {
        return Err(status
            .error
            .unwrap_or_else(|| format!("External agent {} is not ready.", request.agent_id)));
    }

    let mut client = AcpProcessClient::start(app, request)?;
    client.initialize()?;
    let session = client.create_session()?;
    set_active_session_id(&client.request.run_id, session.session_id.clone())?;
    client.apply_session_config(&session)?;
    let stop_reason = client.prompt(&session.session_id)?;
    client.emit_event(
        ExternalAiRunEventKind::Completed,
        format!("External agent stopped: {}", stop_reason),
        None,
    );

    Ok(ExternalAiPromptResponse {
        agent_id: client.request.agent_id.clone(),
        stop_reason,
        transcript: client.transcript.clone(),
    })
}

impl AcpProcessClient {
    fn start(app: AppHandle, request: ExternalAiPromptRequest) -> Result<Self, String> {
        let repo_root = fs::canonicalize(&request.repo_path).map_err(|e| {
            format!(
                "Could not resolve repository path {}: {}",
                request.repo_path, e
            )
        })?;
        let (program, args) = external_agent_command(&request.agent_id)?;
        let mut child = Command::new(&program)
            .args(args)
            .current_dir(&repo_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Could not start external agent {}: {}", request.agent_id, e))?;

        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines() {
                    if line.is_err() {
                        break;
                    }
                }
            });
        }

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "External agent stdin is unavailable.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "External agent stdout is unavailable.".to_string())?;
        let stdout_lines = spawn_stdout_reader(stdout);
        let writer = Arc::new(Mutex::new(stdin));
        register_active_run(&request.run_id, writer.clone())?;

        Ok(Self {
            app,
            request,
            repo_root,
            child,
            writer,
            stdout_lines,
            next_request_id: 0,
            next_terminal_id: 0,
            terminals: HashMap::new(),
            transcript: String::new(),
        })
    }

    fn initialize(&mut self) -> Result<(), String> {
        let result = self.call(
            "initialize",
            json!({
                "protocolVersion": ACP_PROTOCOL_VERSION,
                "clientCapabilities": {
                    "fs": {
                        "readTextFile": true,
                        "writeTextFile": false
                    },
                    "terminal": true
                },
                "clientInfo": {
                    "name": "gitano",
                    "title": "Gitano",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }),
        )?;

        let protocol_version = result
            .get("protocolVersion")
            .and_then(Value::as_u64)
            .ok_or_else(|| "External agent did not return an ACP protocol version.".to_string())?;
        if protocol_version != u64::from(ACP_PROTOCOL_VERSION) {
            return Err(format!(
                "External agent selected unsupported ACP protocol version {}.",
                protocol_version
            ));
        }

        Ok(())
    }

    fn create_session(&mut self) -> Result<AcpSession, String> {
        let result = self.call(
            "session/new",
            json!({
                "cwd": self.repo_root.to_string_lossy(),
                "mcpServers": [],
            }),
        )?;

        let session_id = result
            .get("sessionId")
            .and_then(Value::as_str)
            .map(ToString::to_string)
            .ok_or_else(|| "External agent did not return a session id.".to_string())?;
        let (config_options, mode_config_fallback) = session_config_options(&result);

        Ok(AcpSession {
            session_id,
            config_options,
            mode_config_fallback,
        })
    }

    fn apply_session_config(&mut self, session: &AcpSession) -> Result<(), String> {
        let mut values = self
            .request
            .external_agent_option_overrides
            .iter()
            .map(|(config_id, value)| (config_id.clone(), value.clone()))
            .collect::<Vec<_>>();
        values.sort_by(|(left, _), (right, _)| left.cmp(right));

        for (config_id, value) in values {
            let Some(option) = session
                .config_options
                .iter()
                .find(|option| option.id == config_id)
            else {
                continue;
            };
            if option.option_type != "select"
                || !option.options.iter().any(|option| option.value == value)
            {
                continue;
            }

            if session.mode_config_fallback && config_id == "mode" {
                self.call(
                    "session/set_mode",
                    json!({
                        "sessionId": session.session_id.as_str(),
                        "modeId": value,
                    }),
                )?;
            } else {
                self.call(
                    "session/set_config_option",
                    json!({
                        "sessionId": session.session_id.as_str(),
                        "configId": config_id,
                        "value": value,
                    }),
                )?;
            }
        }

        Ok(())
    }

    fn prompt(&mut self, session_id: &str) -> Result<String, String> {
        let result = self.call(
            "session/prompt",
            json!({
                "sessionId": session_id,
                "prompt": [
                    {
                        "type": "text",
                        "text": self.request.prompt
                    }
                ],
            }),
        )?;

        result
            .get("stopReason")
            .and_then(Value::as_str)
            .map(ToString::to_string)
            .ok_or_else(|| "External agent did not return a stop reason.".to_string())
    }

    fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id();
        write_message(
            &self.writer,
            &json!({
                "jsonrpc": JSON_RPC_VERSION,
                "id": id,
                "method": method,
                "params": params,
            }),
        )?;

        loop {
            let message = self.read_message()?;
            if message.id.as_ref() == Some(&id) && message.method.is_none() {
                if let Some(error) = message.error {
                    return Err(format!(
                        "External agent returned JSON-RPC error {}: {}",
                        error.code, error.message
                    ));
                }
                return Ok(message.result.unwrap_or(Value::Null));
            }

            self.handle_message(message)?;
        }
    }

    fn next_id(&mut self) -> Value {
        let id = self.next_request_id;
        self.next_request_id += 1;
        json!(id)
    }

    fn read_message(&mut self) -> Result<RpcMessage, String> {
        loop {
            let line = match self.stdout_lines.recv_timeout(EXTERNAL_AGENT_IDLE_TIMEOUT) {
                Ok(Ok(line)) => line,
                Ok(Err(error)) => return Err(error),
                Err(RecvTimeoutError::Timeout) => {
                    if let Ok(Some(status)) = self.child.try_wait() {
                        return Err(format!(
                            "External agent exited before completing the request: {}.",
                            status
                        ));
                    }

                    let message = external_agent_idle_timeout_message();
                    self.emit_event(
                        ExternalAiRunEventKind::Error,
                        message.clone(),
                        Some(json!({
                            "timeoutSeconds": EXTERNAL_AGENT_IDLE_TIMEOUT.as_secs(),
                        })),
                    );
                    return Err(message);
                }
                Err(RecvTimeoutError::Disconnected) => {
                    return Err(
                        "External agent connection closed before completing the request."
                            .to_string(),
                    );
                }
            };
            if line.trim().is_empty() {
                continue;
            }

            return serde_json::from_str(line.trim_end())
                .map_err(|e| format!("External agent sent invalid JSON-RPC: {}", e));
        }
    }

    fn handle_message(&mut self, message: RpcMessage) -> Result<(), String> {
        match (message.id, message.method.as_deref(), message.params) {
            (None, Some("session/update"), Some(params)) => {
                if let Some(event) = normalize_session_update(&self.request, &params) {
                    if event.kind == ExternalAiRunEventKind::Text {
                        self.transcript.push_str(&event.message);
                    }
                    let kind = event.kind;
                    let message = event.message.clone();
                    let _ = self.app.emit(EXTERNAL_AI_RUN_EVENT, event);
                    emit_compatible_run_progress(&self.app, &self.request, kind, message);
                }
                Ok(())
            }
            (Some(id), Some("fs/read_text_file"), Some(params)) => {
                self.handle_read_text_file(id, params)
            }
            (Some(id), Some("fs/write_text_file"), params) => {
                self.emit_event(
                    ExternalAiRunEventKind::PermissionDenied,
                    "External agent file writes are disabled.".to_string(),
                    params,
                );
                self.respond_error(
                    id,
                    -32000,
                    "Gitano does not allow external agents to modify repository files.",
                )
            }
            (Some(id), Some("session/request_permission"), Some(params)) => {
                self.handle_permission_request(id, params)
            }
            (Some(id), Some("terminal/create"), Some(params)) => {
                self.handle_terminal_create(id, params)
            }
            (Some(id), Some("terminal/output"), Some(params)) => {
                self.handle_terminal_output(id, params)
            }
            (Some(id), Some("terminal/wait_for_exit"), Some(params)) => {
                self.handle_terminal_wait_for_exit(id, params)
            }
            (Some(id), Some("terminal/kill"), Some(params)) => {
                self.handle_terminal_kill(id, params)
            }
            (Some(id), Some("terminal/release"), Some(params)) => {
                self.handle_terminal_release(id, params)
            }
            (Some(id), Some(method), params) if method.starts_with("terminal/") => {
                self.emit_event(
                    ExternalAiRunEventKind::PermissionDenied,
                    format!("External agent terminal request unsupported: {}", method),
                    params,
                );
                self.respond_error(
                    id,
                    -32601,
                    &format!("Unsupported ACP terminal method: {}", method),
                )
            }
            (Some(id), Some(method), _) => self.respond_error(
                id,
                -32601,
                &format!("Unsupported ACP client method: {}", method),
            ),
            _ => Ok(()),
        }
    }

    fn handle_read_text_file(&mut self, id: Value, params: Value) -> Result<(), String> {
        let path = params.get("path").and_then(Value::as_str).ok_or_else(|| {
            "External agent file read request did not include a path.".to_string()
        })?;
        let line = params
            .get("line")
            .and_then(Value::as_u64)
            .map(|line| line as usize);
        let limit = params
            .get("limit")
            .and_then(Value::as_u64)
            .map(|limit| limit as usize);

        match read_repo_text_file(&self.repo_root, path, line, limit) {
            Ok(content) => {
                self.emit_event(
                    ExternalAiRunEventKind::FileRead,
                    format!("Read {}", path),
                    Some(params),
                );
                self.respond_result(id, json!({ "content": content }))
            }
            Err(error) => {
                self.emit_event(ExternalAiRunEventKind::Error, error.clone(), Some(params));
                self.respond_error(id, -32001, &error)
            }
        }
    }

    fn handle_permission_request(&mut self, id: Value, params: Value) -> Result<(), String> {
        let (outcome, message, kind) = if permission_request_is_read_only_terminal(&params) {
            (
                permission_allow_outcome(&params)
                    .unwrap_or_else(|| permission_denial_outcome(&params)),
                "Allowed read-only external agent command.".to_string(),
                ExternalAiRunEventKind::ToolCallUpdate,
            )
        } else {
            (
                permission_denial_outcome(&params),
                "External agent permission request denied.".to_string(),
                ExternalAiRunEventKind::PermissionDenied,
            )
        };
        self.emit_event(kind, message, Some(params));
        self.respond_result(id, json!({ "outcome": outcome }))
    }

    fn handle_terminal_create(&mut self, id: Value, params: Value) -> Result<(), String> {
        let command = params
            .get("command")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                "External agent terminal request did not include a command.".to_string()
            })?;
        let args = params
            .get("args")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let cwd = params
            .get("cwd")
            .and_then(Value::as_str)
            .map(PathBuf::from)
            .unwrap_or_else(|| self.repo_root.clone());
        let cwd =
            fs::canonicalize(&cwd).map_err(|e| format!("Could not resolve terminal cwd: {}", e))?;

        if !cwd.starts_with(&self.repo_root) {
            self.emit_event(
                ExternalAiRunEventKind::PermissionDenied,
                "External agent terminal cwd is outside the active repository.".to_string(),
                Some(params),
            );
            return self.respond_error(
                id,
                -32000,
                "Gitano only allows external agent commands inside the active repository.",
            );
        }

        let Some(prepared_command) = prepare_terminal_command(command, &args) else {
            let display = terminal_command_display(command, &args);
            self.emit_event(
                ExternalAiRunEventKind::PermissionDenied,
                format!("Blocked terminal command: {}", display),
                Some(params),
            );
            return self.respond_error(
                id,
                -32000,
                "Gitano only allows read-only inspection commands for external agents.",
            );
        };

        let output_limit = params
            .get("outputByteLimit")
            .and_then(Value::as_u64)
            .map(|value| (value as usize).clamp(1, MAX_TERMINAL_OUTPUT_LIMIT))
            .unwrap_or(DEFAULT_TERMINAL_OUTPUT_LIMIT);
        let mut terminal_command = Command::new(&prepared_command.program);
        terminal_command
            .args(&prepared_command.args)
            .current_dir(&cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        terminal_command
            .env_remove("GIT_EXTERNAL_DIFF")
            .env_remove("GIT_DIFF_OPTS")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_CONFIG_GLOBAL", empty_git_config_path())
            .env("GIT_PAGER", "cat")
            .env("NO_COLOR", "1");

        let mut child = terminal_command
            .spawn()
            .map_err(|e| format!("Could not start external agent terminal command: {}", e))?;
        let terminal_id = self.next_terminal_id();
        let output = Arc::new(Mutex::new(TerminalOutput::default()));
        let display = prepared_command.display;

        if let Some(stdout) = child.stdout.take() {
            spawn_terminal_reader(
                stdout,
                output.clone(),
                output_limit,
                self.app.clone(),
                self.request.clone(),
                terminal_id.clone(),
                "stdout",
            );
        }
        if let Some(stderr) = child.stderr.take() {
            spawn_terminal_reader(
                stderr,
                output.clone(),
                output_limit,
                self.app.clone(),
                self.request.clone(),
                terminal_id.clone(),
                "stderr",
            );
        }

        self.emit_event(
            ExternalAiRunEventKind::ToolCall,
            format!("{}\n{}", cwd.to_string_lossy(), display),
            Some(json!({
                "terminalId": terminal_id,
                "command": prepared_command.program,
                "args": prepared_command.args,
                "cwd": cwd.to_string_lossy(),
            })),
        );
        self.terminals
            .insert(terminal_id.clone(), TerminalSession { child, output });
        self.respond_result(id, json!({ "terminalId": terminal_id }))
    }

    fn handle_terminal_output(&mut self, id: Value, params: Value) -> Result<(), String> {
        let terminal_id = terminal_id_param(&params)?;
        let Some(terminal) = self.terminals.get_mut(&terminal_id) else {
            return self.respond_error(id, -32004, "Unknown external agent terminal id.");
        };
        let exit_status = terminal_try_exit_status(terminal);
        let output = terminal_output_snapshot(&terminal.output);

        self.respond_result(
            id,
            json!({
                "output": output.text,
                "truncated": output.truncated,
                "exitStatus": exit_status,
            }),
        )
    }

    fn handle_terminal_wait_for_exit(&mut self, id: Value, params: Value) -> Result<(), String> {
        let terminal_id = terminal_id_param(&params)?;
        let Some(terminal) = self.terminals.get_mut(&terminal_id) else {
            return self.respond_error(id, -32004, "Unknown external agent terminal id.");
        };
        let status = terminal
            .child
            .wait()
            .map_err(|e| format!("Could not wait for external agent terminal: {}", e))?;
        let exit_status = json!({
            "exitCode": status.code(),
            "signal": Value::Null,
        });

        self.respond_result(id, exit_status)
    }

    fn handle_terminal_kill(&mut self, id: Value, params: Value) -> Result<(), String> {
        let terminal_id = terminal_id_param(&params)?;
        let Some(terminal) = self.terminals.get_mut(&terminal_id) else {
            return self.respond_error(id, -32004, "Unknown external agent terminal id.");
        };

        terminal
            .child
            .kill()
            .map_err(|e| format!("Could not kill external agent terminal: {}", e))?;
        self.emit_event(
            ExternalAiRunEventKind::ToolCallUpdate,
            format!("Terminal command killed: {}", terminal_id),
            Some(params),
        );
        self.respond_result(id, json!({}))
    }

    fn handle_terminal_release(&mut self, id: Value, params: Value) -> Result<(), String> {
        let terminal_id = terminal_id_param(&params)?;
        let Some(mut terminal) = self.terminals.remove(&terminal_id) else {
            return self.respond_error(id, -32004, "Unknown external agent terminal id.");
        };

        if terminal
            .child
            .try_wait()
            .map_err(|e| e.to_string())?
            .is_none()
        {
            let _ = terminal.child.kill();
        }
        let _ = terminal.child.wait();
        self.respond_result(id, json!({}))
    }

    fn respond_result(&mut self, id: Value, result: Value) -> Result<(), String> {
        write_message(
            &self.writer,
            &json!({
                "jsonrpc": JSON_RPC_VERSION,
                "id": id,
                "result": result,
            }),
        )
    }

    fn next_terminal_id(&mut self) -> String {
        let id = self.next_terminal_id;
        self.next_terminal_id += 1;
        format!("gitano-terminal-{}", id)
    }

    fn respond_error(&mut self, id: Value, code: i64, message: &str) -> Result<(), String> {
        write_message(
            &self.writer,
            &json!({
                "jsonrpc": JSON_RPC_VERSION,
                "id": id,
                "error": {
                    "code": code,
                    "message": message
                },
            }),
        )
    }

    fn emit_event(&self, kind: ExternalAiRunEventKind, message: String, raw: Option<Value>) {
        let _ = self.app.emit(
            EXTERNAL_AI_RUN_EVENT,
            ExternalAiRunEvent {
                run_id: self.request.run_id.clone(),
                action_kind: self.request.action_kind,
                agent_id: self.request.agent_id.clone(),
                kind,
                message: message.clone(),
                raw,
            },
        );
        emit_compatible_run_progress(&self.app, &self.request, kind, message);
    }
}

fn external_agent_config_probe_cwd(repo_path: Option<&str>) -> Result<String, String> {
    if let Some(repo_path) = repo_path.map(str::trim).filter(|path| !path.is_empty()) {
        if let Ok(path) = fs::canonicalize(repo_path) {
            if path.is_dir() {
                return Ok(path.to_string_lossy().to_string());
            }
        }
    }

    let path = super::models::local_ai_data_dir().join("external-agent-config-probe");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    fs::canonicalize(&path)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

fn session_config_options(result: &Value) -> (Vec<ExternalAiAgentConfigOption>, bool) {
    let config_options = result
        .get("configOptions")
        .and_then(Value::as_array)
        .map(|options| {
            options
                .iter()
                .filter_map(config_option_from_value)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if !config_options.is_empty() {
        return (config_options, false);
    }

    match mode_config_option_from_value(result.get("modes")) {
        Some(option) => (vec![option], true),
        None => (Vec::new(), false),
    }
}

fn config_option_from_value(value: &Value) -> Option<ExternalAiAgentConfigOption> {
    let option_type = value.get("type").and_then(Value::as_str)?.to_string();
    let options = value
        .get("options")?
        .as_array()?
        .iter()
        .filter_map(config_option_value_from_value)
        .collect::<Vec<_>>();
    if options.is_empty() {
        return None;
    }

    Some(ExternalAiAgentConfigOption {
        id: value.get("id")?.as_str()?.to_string(),
        name: value.get("name")?.as_str()?.to_string(),
        description: value
            .get("description")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        category: value
            .get("category")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        option_type,
        current_value: value.get("currentValue")?.as_str()?.to_string(),
        options,
    })
}

fn config_option_value_from_value(value: &Value) -> Option<ExternalAiAgentConfigOptionValue> {
    Some(ExternalAiAgentConfigOptionValue {
        value: value.get("value")?.as_str()?.to_string(),
        name: value.get("name")?.as_str()?.to_string(),
        description: value
            .get("description")
            .and_then(Value::as_str)
            .map(ToString::to_string),
    })
}

fn mode_config_option_from_value(value: Option<&Value>) -> Option<ExternalAiAgentConfigOption> {
    let modes = value?;
    let current_value = modes.get("currentModeId")?.as_str()?.to_string();
    let options = modes
        .get("availableModes")?
        .as_array()?
        .iter()
        .filter_map(|mode| {
            Some(ExternalAiAgentConfigOptionValue {
                value: mode.get("id")?.as_str()?.to_string(),
                name: mode.get("name")?.as_str()?.to_string(),
                description: mode
                    .get("description")
                    .and_then(Value::as_str)
                    .map(ToString::to_string),
            })
        })
        .collect::<Vec<_>>();
    if options.is_empty() {
        return None;
    }

    Some(ExternalAiAgentConfigOption {
        id: "mode".to_string(),
        name: "Session Mode".to_string(),
        description: Some("Controls how the agent handles tool permissions.".to_string()),
        category: Some("mode".to_string()),
        option_type: "select".to_string(),
        current_value,
        options,
    })
}

fn terminal_id_param(params: &Value) -> Result<String, String> {
    params
        .get("terminalId")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| "External agent terminal request did not include a terminal id.".to_string())
}

fn terminal_try_exit_status(terminal: &mut TerminalSession) -> Value {
    match terminal.child.try_wait() {
        Ok(Some(status)) => json!({
            "exitCode": status.code(),
            "signal": Value::Null,
        }),
        Ok(None) | Err(_) => Value::Null,
    }
}

fn terminal_output_snapshot(output: &Arc<Mutex<TerminalOutput>>) -> TerminalOutput {
    let Ok(output) = output.lock() else {
        return TerminalOutput::default();
    };

    TerminalOutput {
        text: output.text.clone(),
        truncated: output.truncated,
    }
}

fn spawn_terminal_reader<R>(
    mut reader: R,
    output: Arc<Mutex<TerminalOutput>>,
    output_limit: usize,
    app: AppHandle,
    request: ExternalAiPromptRequest,
    terminal_id: String,
    stream_name: &'static str,
) where
    R: Read + Send + 'static,
{
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        loop {
            let bytes_read = match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(bytes_read) => bytes_read,
                Err(_) => break,
            };
            let chunk = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
            append_terminal_output(&output, &chunk, output_limit);
            emit_external_run_event(
                &app,
                &request,
                ExternalAiRunEventKind::ToolCallUpdate,
                terminal_output_message(stream_name, &chunk),
                Some(json!({
                    "terminalId": terminal_id,
                    "stream": stream_name,
                    "chunk": chunk,
                })),
            );
        }
    });
}

fn append_terminal_output(output: &Arc<Mutex<TerminalOutput>>, chunk: &str, output_limit: usize) {
    let Ok(mut output) = output.lock() else {
        return;
    };
    output.text.push_str(chunk);

    if output.text.len() <= output_limit {
        return;
    }

    let mut start = output.text.len().saturating_sub(output_limit);
    while start < output.text.len() && !output.text.is_char_boundary(start) {
        start += 1;
    }
    output.text.drain(..start);
    output.truncated = true;
}

fn terminal_output_message(stream_name: &str, chunk: &str) -> String {
    let trimmed = chunk.trim();
    if trimmed.is_empty() {
        format!("Terminal {} output", stream_name)
    } else {
        format!("Terminal {}: {}", stream_name, trimmed)
    }
}

fn terminal_command_display(command: &str, args: &[String]) -> String {
    std::iter::once(command.to_string())
        .chain(args.iter().map(|arg| shell_quote_for_display(arg)))
        .collect::<Vec<_>>()
        .join(" ")
}

fn shell_quote_for_display(value: &str) -> String {
    if value.chars().any(char::is_whitespace) {
        format!("'{}'", value.replace('\'', "'\\''"))
    } else {
        value.to_string()
    }
}

fn prepare_terminal_command(command: &str, args: &[String]) -> Option<PreparedTerminalCommand> {
    let command_name = command_name(command);
    if command_name == "git" {
        return prepare_git_command(command, args);
    }

    if matches!(command_name, "bash" | "sh" | "zsh") {
        let shell_args = parse_read_only_shell_command(args)?;
        return prepare_git_command("git", &shell_args);
    }

    None
}

fn is_read_only_terminal_command(command: &str, args: &[String]) -> bool {
    prepare_terminal_command(command, args).is_some()
}

fn command_name(command: &str) -> &str {
    Path::new(command)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(command)
}

fn parse_read_only_shell_command(args: &[String]) -> Option<Vec<String>> {
    let command_text = match args {
        [flag, command_text] if flag == "-c" || flag == "-lc" => command_text,
        [login_flag, command_flag, command_text]
            if login_flag == "-l" && (command_flag == "-c" || command_flag == "-lc") =>
        {
            command_text
        }
        _ => return None,
    };

    if command_text
        .chars()
        .any(|character| matches!(character, ';' | '&' | '|' | '>' | '<' | '`' | '\n' | '\r'))
        || command_text.contains("$(")
    {
        return None;
    }

    let parts = command_text
        .split_whitespace()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    let Some((command, args)) = parts.split_first() else {
        return None;
    };

    if command == "git" && is_read_only_git_command(args) {
        Some(args.to_vec())
    } else {
        None
    }
}

fn prepare_git_command(command: &str, args: &[String]) -> Option<PreparedTerminalCommand> {
    if !is_read_only_git_command(args) {
        return None;
    }

    let sanitized_args = SANITIZED_GIT_CONFIG_ARGS
        .iter()
        .map(|arg| (*arg).to_string())
        .chain(args.iter().cloned())
        .collect::<Vec<_>>();

    Some(PreparedTerminalCommand {
        program: command.to_string(),
        args: sanitized_args.clone(),
        display: terminal_command_display(command, args),
    })
}

fn is_read_only_git_command(args: &[String]) -> bool {
    let Some(subcommand) = args.first() else {
        return false;
    };

    matches!(
        subcommand.as_str(),
        "diff" | "status" | "show" | "log" | "ls-files" | "rev-parse" | "merge-base"
    ) && args.iter().all(git_arg_is_read_only)
}

fn git_arg_is_read_only(arg: &String) -> bool {
    if arg == "--ext-diff"
        || arg.starts_with("--ext-diff=")
        || arg == "--no-index"
        || arg == "--output"
        || arg.starts_with("--output=")
    {
        return false;
    }

    let path = Path::new(arg);
    !path.is_absolute()
        && !path
            .components()
            .any(|component| matches!(component, std::path::Component::ParentDir))
}

fn empty_git_config_path() -> &'static str {
    if cfg!(windows) {
        "NUL"
    } else {
        "/dev/null"
    }
}

fn emit_external_run_event(
    app: &AppHandle,
    request: &ExternalAiPromptRequest,
    kind: ExternalAiRunEventKind,
    message: String,
    raw: Option<Value>,
) {
    let _ = app.emit(
        EXTERNAL_AI_RUN_EVENT,
        ExternalAiRunEvent {
            run_id: request.run_id.clone(),
            action_kind: request.action_kind,
            agent_id: request.agent_id.clone(),
            kind,
            message: message.clone(),
            raw,
        },
    );
    emit_compatible_run_progress(app, request, kind, message);
}

fn emit_compatible_run_progress(
    app: &AppHandle,
    request: &ExternalAiPromptRequest,
    kind: ExternalAiRunEventKind,
    message: String,
) {
    if !matches!(
        request.action_kind,
        LocalAiActionKind::CommitAnalysis
            | LocalAiActionKind::BranchAnalysis
            | LocalAiActionKind::BranchReview
    ) {
        return;
    }
    if request.run_id.trim().is_empty() {
        return;
    }

    let (state, error) = match kind {
        ExternalAiRunEventKind::Completed => (LocalAiRunProgressState::Completed, None),
        ExternalAiRunEventKind::Error => (LocalAiRunProgressState::Failed, Some(message.clone())),
        _ => (LocalAiRunProgressState::RunningModel, None),
    };
    let progress_message = compatible_progress_message(kind, &message);

    let _ = app.emit(
        LOCAL_AI_RUN_PROGRESS_EVENT,
        LocalAiRunProgress {
            run_id: request.run_id.clone(),
            action_kind: request.action_kind,
            state,
            message: progress_message,
            error,
        },
    );
}

fn compatible_progress_message(kind: ExternalAiRunEventKind, message: &str) -> String {
    match kind {
        ExternalAiRunEventKind::Text => "Receiving external agent response".to_string(),
        ExternalAiRunEventKind::Thought => "External agent is thinking".to_string(),
        ExternalAiRunEventKind::Completed => "External agent completed".to_string(),
        _ => message.to_string(),
    }
}

fn external_agent_idle_timeout_message() -> String {
    format!(
        "External agent connection appears stalled. No response was received for {} seconds. Check your internet connection and try again.",
        EXTERNAL_AGENT_IDLE_TIMEOUT.as_secs()
    )
}

fn spawn_stdout_reader(stdout: ChildStdout) -> Receiver<Result<String, String>> {
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            let mut line = String::new();
            match reader.read_line(&mut line) {
                Ok(0) => {
                    let _ = sender.send(Err(
                        "External agent connection closed before completing the request."
                            .to_string(),
                    ));
                    break;
                }
                Ok(_) => {
                    if sender.send(Ok(line)).is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let _ = sender.send(Err(format!(
                        "External agent transport read failed: {}",
                        error
                    )));
                    break;
                }
            }
        }
    });
    receiver
}

fn write_message(writer: &Arc<Mutex<ChildStdin>>, message: &Value) -> Result<(), String> {
    let mut writer = writer.lock().map_err(|e| e.to_string())?;
    let line = serde_json::to_string(message).map_err(|e| e.to_string())?;
    writer
        .write_all(line.as_bytes())
        .and_then(|_| writer.write_all(b"\n"))
        .and_then(|_| writer.flush())
        .map_err(|e| format!("External agent transport write failed: {}", e))
}

fn register_active_run(run_id: &str, writer: Arc<Mutex<ChildStdin>>) -> Result<(), String> {
    let mut runs = ACTIVE_RUNS.lock().map_err(|e| e.to_string())?;
    runs.insert(
        run_id.to_string(),
        ActiveRun {
            session_id: None,
            writer,
        },
    );
    Ok(())
}

fn set_active_session_id(run_id: &str, session_id: String) -> Result<(), String> {
    let mut runs = ACTIVE_RUNS.lock().map_err(|e| e.to_string())?;
    if let Some(run) = runs.get_mut(run_id) {
        run.session_id = Some(session_id);
    }
    Ok(())
}

fn unregister_active_run(run_id: &str) {
    if let Ok(mut runs) = ACTIVE_RUNS.lock() {
        runs.remove(run_id);
    }
}

fn normalize_session_update(
    request: &ExternalAiPromptRequest,
    params: &Value,
) -> Option<ExternalAiRunEvent> {
    let update = params.get("update")?;
    let session_update = update.get("sessionUpdate").and_then(Value::as_str)?;
    let (kind, message) = match session_update {
        "agent_message_chunk" => (
            ExternalAiRunEventKind::Text,
            content_text(update.get("content")?)?,
        ),
        "agent_thought_chunk" => (
            ExternalAiRunEventKind::Thought,
            content_text(update.get("content")?)?,
        ),
        "plan" => (ExternalAiRunEventKind::Plan, plan_message(update)?),
        "tool_call" => (ExternalAiRunEventKind::ToolCall, tool_call_message(update)),
        "tool_call_update" => (
            ExternalAiRunEventKind::ToolCallUpdate,
            tool_call_update_message(update),
        ),
        _ => return None,
    };

    Some(ExternalAiRunEvent {
        run_id: request.run_id.clone(),
        action_kind: request.action_kind,
        agent_id: request.agent_id.clone(),
        kind,
        message,
        raw: Some(params.clone()),
    })
}

fn content_text(content: &Value) -> Option<String> {
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }

    if let Some(items) = content.as_array() {
        let message = items
            .iter()
            .filter_map(content_text)
            .collect::<Vec<_>>()
            .join("");

        return if message.is_empty() {
            None
        } else {
            Some(message)
        };
    }

    match content.get("type").and_then(Value::as_str) {
        Some("text") => content
            .get("text")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        Some("resource_link") => content
            .get("title")
            .or_else(|| content.get("name"))
            .or_else(|| content.get("uri"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
        _ => None,
    }
}

fn plan_message(update: &Value) -> Option<String> {
    let entries = update.get("entries").and_then(Value::as_array)?;
    let message = entries
        .iter()
        .filter_map(|entry| {
            let content = entry.get("content").and_then(Value::as_str)?;
            let status = entry
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("pending");
            Some(format!("{}: {}", status, content))
        })
        .collect::<Vec<_>>()
        .join("\n");

    if message.is_empty() {
        None
    } else {
        Some(message)
    }
}

fn tool_call_message(update: &Value) -> String {
    let title = update
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("External agent tool call");
    let status = update
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("pending");
    let mut parts = vec![format!("{} ({})", title, status)];
    if let Some(input) = tool_call_raw_input_message(update.get("rawInput")) {
        parts.push(input);
    }
    if let Some(locations) = tool_call_locations_message(update) {
        parts.push(locations);
    }
    parts.join("\n")
}

fn tool_call_update_message(update: &Value) -> String {
    let mut parts = Vec::new();
    if let Some(title) = update.get("title").and_then(Value::as_str) {
        parts.push(title.to_string());
    }
    if let Some(status) = update.get("status").and_then(Value::as_str) {
        parts.push(status.to_string());
    }
    if let Some(content) = update.get("content").and_then(Value::as_array) {
        parts.extend(content.iter().filter_map(tool_call_content_message));
    }
    if let Some(input) = tool_call_raw_input_message(update.get("rawInput")) {
        parts.push(input);
    }
    if let Some(output) = tool_call_raw_output_message(update.get("rawOutput")) {
        parts.push(output);
    }
    if let Some(locations) = tool_call_locations_message(update) {
        parts.push(locations);
    }

    if parts.is_empty() {
        "External agent tool call updated".to_string()
    } else {
        parts.join("\n")
    }
}

fn tool_call_content_message(content: &Value) -> Option<String> {
    match content.get("type").and_then(Value::as_str)? {
        "content" => content.get("content").and_then(content_text),
        "diff" => content
            .get("path")
            .and_then(Value::as_str)
            .map(|path| format!("Proposed file change: {}", path)),
        "terminal" => Some("Terminal output requested".to_string()),
        _ => None,
    }
}

fn tool_call_raw_input_message(raw_input: Option<&Value>) -> Option<String> {
    let raw_input = raw_input?;

    if let Some(text) = raw_input.as_str() {
        return Some(truncate_event_message(text));
    }

    let object = raw_input.as_object()?;
    if let Some(command) = command_display_from_fields(object.get("command"), object.get("args")) {
        return Some(command);
    }
    if let Some(command) = command_display_from_parsed_cmd(object.get("parsed_cmd")) {
        return Some(command);
    }

    for key in ["path", "filePath", "query", "pattern", "cmd"] {
        if let Some(value) = object.get(key).and_then(Value::as_str) {
            return Some(truncate_event_message(value));
        }
    }

    serde_json::to_string(raw_input)
        .ok()
        .map(|message| truncate_event_message(&message))
}

fn tool_call_raw_output_message(raw_output: Option<&Value>) -> Option<String> {
    let raw_output = raw_output?;

    if let Some(text) = raw_output.as_str() {
        return Some(truncate_event_message(text));
    }

    if let Some(object) = raw_output.as_object() {
        if let Some(command) =
            command_display_from_fields(object.get("command"), object.get("args"))
                .or_else(|| command_display_from_parsed_cmd(object.get("parsed_cmd")))
        {
            if let Some(output) = tool_output_text(object) {
                return Some(format!(
                    "{}\n{}",
                    command,
                    truncate_event_message_with_limit(&output, 1_200)
                ));
            }

            return Some(command);
        }

        if let Some(output) = tool_output_text(object) {
            return Some(truncate_event_message_with_limit(&output, 1_200));
        }

        for key in ["status", "exit_code", "exitCode"] {
            if let Some(value) = object.get(key).and_then(Value::as_str) {
                return Some(truncate_event_message(value));
            }
        }
    }

    serde_json::to_string(raw_output)
        .ok()
        .map(|message| truncate_event_message(&message))
}

fn command_display_from_fields(command: Option<&Value>, args: Option<&Value>) -> Option<String> {
    let command = command?;

    if let Some(command) = command.as_str() {
        let args = args.and_then(string_array).unwrap_or_default();
        return Some(shell_command_display(command, &args));
    }

    let items = string_array(command)?;
    command_display_from_parts(&items)
}

fn command_display_from_parsed_cmd(parsed_cmd: Option<&Value>) -> Option<String> {
    let parsed_cmd = parsed_cmd?.as_array()?;
    let first = parsed_cmd.first()?.as_object()?;

    if let Some(command) = first.get("cmd").and_then(Value::as_str) {
        return Some(truncate_event_message(command));
    }

    let items = string_array(first.get("cmd")?)?;
    command_display_from_parts(&items)
}

fn command_display_from_parts(items: &[String]) -> Option<String> {
    let (command, args) = items.split_first()?;
    Some(shell_command_display(command, args))
}

fn string_array(value: &Value) -> Option<Vec<String>> {
    Some(
        value
            .as_array()?
            .iter()
            .filter_map(Value::as_str)
            .map(ToString::to_string)
            .collect::<Vec<_>>(),
    )
}

fn shell_command_display(command: &str, args: &[String]) -> String {
    let command_name = command_name(command);
    if matches!(command_name, "bash" | "sh" | "zsh") {
        if let Some(command_text) = shell_command_text(args) {
            return truncate_event_message(command_text);
        }
    }

    truncate_event_message(&terminal_command_display(command, args))
}

fn shell_command_text(args: &[String]) -> Option<&str> {
    match args {
        [flag, command_text] if flag == "-c" || flag == "-lc" => Some(command_text.as_str()),
        [login_flag, command_flag, command_text]
            if login_flag == "-l" && (command_flag == "-c" || command_flag == "-lc") =>
        {
            Some(command_text.as_str())
        }
        _ => None,
    }
}

fn tool_output_text(object: &serde_json::Map<String, Value>) -> Option<String> {
    for key in [
        "aggregated_output",
        "formatted_output",
        "output",
        "stdout",
        "stderr",
        "content",
        "text",
        "error",
    ] {
        if let Some(value) = object.get(key).and_then(Value::as_str) {
            let output = value.trim();
            if !output.is_empty() {
                return Some(output.to_string());
            }
        }
    }

    None
}

fn tool_call_locations_message(update: &Value) -> Option<String> {
    let locations = update.get("locations")?.as_array()?;
    let message = locations
        .iter()
        .filter_map(|location| {
            let path = location.get("path").and_then(Value::as_str)?;
            let line = location.get("line").and_then(Value::as_u64);
            Some(match line {
                Some(line) => format!("{}:{}", path, line),
                None => path.to_string(),
            })
        })
        .collect::<Vec<_>>()
        .join("\n");

    if message.is_empty() {
        None
    } else {
        Some(message)
    }
}

fn truncate_event_message(message: &str) -> String {
    truncate_event_message_with_limit(message, 4_000)
}

fn truncate_event_message_with_limit(message: &str, max_chars: usize) -> String {
    let trimmed = message.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }

    let mut truncated = trimmed.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn permission_denial_outcome(params: &Value) -> Value {
    let reject_option = params
        .get("options")
        .and_then(Value::as_array)
        .and_then(|options| {
            options.iter().find(|option| {
                option
                    .get("kind")
                    .and_then(Value::as_str)
                    .is_some_and(|kind| kind.starts_with("reject"))
                    || option
                        .get("optionId")
                        .and_then(Value::as_str)
                        .is_some_and(|option_id| {
                            let option_id = option_id.to_ascii_lowercase();
                            option_id.contains("reject") || option_id.contains("deny")
                        })
            })
        })
        .and_then(|option| option.get("optionId").and_then(Value::as_str));

    if let Some(option_id) = reject_option {
        json!({
            "outcome": "selected",
            "optionId": option_id
        })
    } else {
        json!({
            "outcome": "cancelled"
        })
    }
}

fn permission_allow_outcome(params: &Value) -> Option<Value> {
    let option_id = params
        .get("options")
        .and_then(Value::as_array)
        .and_then(|options| {
            options.iter().find(|option| {
                option
                    .get("kind")
                    .and_then(Value::as_str)
                    .is_some_and(|kind| kind.starts_with("allow"))
                    || option
                        .get("optionId")
                        .and_then(Value::as_str)
                        .is_some_and(|option_id| option_id.to_ascii_lowercase().contains("allow"))
            })
        })
        .and_then(|option| option.get("optionId").and_then(Value::as_str))?;

    Some(json!({
        "outcome": "selected",
        "optionId": option_id
    }))
}

fn permission_request_is_read_only_terminal(params: &Value) -> bool {
    let tool_call = params.get("toolCall").unwrap_or(params);
    let kind = tool_call
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or_default();

    if kind != "execute" {
        return false;
    }

    let raw_input = tool_call
        .get("rawInput")
        .or_else(|| tool_call.get("input"))
        .unwrap_or(tool_call);
    let Some(command) = raw_input.get("command").and_then(Value::as_str) else {
        return false;
    };
    let args = raw_input
        .get("args")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    is_read_only_terminal_command(command, &args)
}

fn read_repo_text_file(
    repo_root: &Path,
    path: &str,
    line: Option<usize>,
    limit: Option<usize>,
) -> Result<String, String> {
    let requested_path = Path::new(path);
    if !requested_path.is_absolute() {
        return Err("External agent file read path must be absolute.".to_string());
    }
    let canonical_path =
        fs::canonicalize(requested_path).map_err(|e| format!("Could not read {}: {}", path, e))?;
    if !canonical_path.starts_with(repo_root) {
        return Err("External agent file read is outside the active repository.".to_string());
    }
    if !canonical_path.is_file() {
        return Err("External agent file read target is not a file.".to_string());
    }

    let content = fs::read_to_string(&canonical_path)
        .map_err(|e| format!("Could not read {} as UTF-8 text: {}", path, e))?;
    Ok(slice_text_lines(&content, line, limit))
}

fn slice_text_lines(content: &str, line: Option<usize>, limit: Option<usize>) -> String {
    let start = line.unwrap_or(1).saturating_sub(1);
    let lines = content.lines().skip(start);
    match limit {
        Some(limit) => lines.take(limit).collect::<Vec<_>>().join("\n"),
        None => lines.collect::<Vec<_>>().join("\n"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::types::LocalAiActionKind;

    fn prompt_request() -> ExternalAiPromptRequest {
        ExternalAiPromptRequest {
            agent_id: "codex-acp".to_string(),
            repo_path: "/tmp/repo".to_string(),
            run_id: "run-1".to_string(),
            action_kind: LocalAiActionKind::BranchAnalysis,
            prompt: "Analyze this repo".to_string(),
            external_agent_option_overrides: HashMap::new(),
        }
    }

    #[test]
    fn normalizes_agent_text_update() {
        let event = normalize_session_update(
            &prompt_request(),
            &json!({
                "sessionId": "session-1",
                "update": {
                    "sessionUpdate": "agent_message_chunk",
                    "content": {
                        "type": "text",
                        "text": "First chunk"
                    }
                }
            }),
        )
        .expect("text event");

        assert_eq!(event.kind, ExternalAiRunEventKind::Text);
        assert_eq!(event.message, "First chunk");
    }

    #[test]
    fn normalizes_chunk_content_arrays() {
        let event = normalize_session_update(
            &prompt_request(),
            &json!({
                "sessionId": "session-1",
                "update": {
                    "sessionUpdate": "agent_thought_chunk",
                    "content": [
                        {
                            "type": "text",
                            "text": "Reading "
                        },
                        {
                            "type": "text",
                            "text": "diff"
                        }
                    ]
                }
            }),
        )
        .expect("thought event");

        assert_eq!(event.kind, ExternalAiRunEventKind::Thought);
        assert_eq!(event.message, "Reading diff");
    }

    #[test]
    fn compatible_progress_hides_raw_text_chunks() {
        let message = compatible_progress_message(ExternalAiRunEventKind::Text, "{\"summary\"");

        assert_eq!(message, "Receiving external agent response");
    }

    #[test]
    fn parses_session_config_options() {
        let (options, fallback) = session_config_options(&json!({
            "sessionId": "session-1",
            "configOptions": [
                {
                    "id": "model",
                    "name": "Model",
                    "category": "model",
                    "type": "select",
                    "currentValue": "gpt-5.5",
                    "options": [
                        {
                            "value": "gpt-5.5",
                            "name": "GPT-5.5",
                            "description": "Best model"
                        }
                    ]
                }
            ]
        }));

        assert!(!fallback);
        assert_eq!(options.len(), 1);
        assert_eq!(options[0].id, "model");
        assert_eq!(options[0].category.as_deref(), Some("model"));
        assert_eq!(options[0].options[0].value, "gpt-5.5");
    }

    #[test]
    fn maps_legacy_modes_to_config_option() {
        let (options, fallback) = session_config_options(&json!({
            "sessionId": "session-1",
            "modes": {
                "currentModeId": "ask",
                "availableModes": [
                    {
                        "id": "ask",
                        "name": "Ask",
                        "description": "Request permission"
                    },
                    {
                        "id": "code",
                        "name": "Code"
                    }
                ]
            }
        }));

        assert!(fallback);
        assert_eq!(options.len(), 1);
        assert_eq!(options[0].id, "mode");
        assert_eq!(options[0].current_value, "ask");
        assert_eq!(options[0].options[1].value, "code");
    }

    #[test]
    fn read_only_terminal_command_allows_git_diff() {
        let args = vec![
            "diff".to_string(),
            "--cached".to_string(),
            "--name-only".to_string(),
        ];

        assert!(is_read_only_terminal_command("git", &args));
    }

    #[test]
    fn read_only_terminal_command_rejects_git_checkout() {
        let args = vec!["checkout".to_string(), "main".to_string()];

        assert!(!is_read_only_terminal_command("git", &args));
    }

    #[test]
    fn read_only_terminal_command_rejects_git_output_write() {
        let args = vec!["diff".to_string(), "--output=result.patch".to_string()];

        assert!(!is_read_only_terminal_command("git", &args));
    }

    #[test]
    fn read_only_terminal_command_rejects_path_escape() {
        let args = vec![
            "diff".to_string(),
            "--no-index".to_string(),
            "../outside".to_string(),
            "src/main.rs".to_string(),
        ];

        assert!(!is_read_only_terminal_command("git", &args));
    }

    #[test]
    fn read_only_terminal_command_allows_simple_shell_git_status() {
        let args = vec!["-lc".to_string(), "git status --short".to_string()];

        assert!(is_read_only_terminal_command("bash", &args));
    }

    #[test]
    fn shell_git_command_is_sanitized_to_direct_git() {
        let args = vec!["-lc".to_string(), "git status --short".to_string()];
        let prepared = prepare_terminal_command("bash", &args).expect("prepared command");
        let sanitized_args = SANITIZED_GIT_CONFIG_ARGS
            .iter()
            .map(|arg| (*arg).to_string())
            .collect::<Vec<_>>();

        assert_eq!(prepared.program, "git");
        assert_eq!(
            &prepared.args[..sanitized_args.len()],
            sanitized_args.as_slice()
        );
        assert!(prepared
            .args
            .ends_with(&["status".to_string(), "--short".to_string()]));
    }

    #[test]
    fn read_only_terminal_command_rejects_shell_control_operators() {
        let args = vec![
            "-lc".to_string(),
            "git status --short && rm file".to_string(),
        ];

        assert!(!is_read_only_terminal_command("bash", &args));
    }

    #[test]
    fn normalizes_execute_tool_call_raw_input() {
        let event = normalize_session_update(
            &prompt_request(),
            &json!({
                "sessionId": "session-1",
                "update": {
                    "sessionUpdate": "tool_call",
                    "toolCallId": "tool-1",
                    "title": "Run git status",
                    "kind": "execute",
                    "status": "in_progress",
                    "rawInput": {
                        "command": "git",
                        "args": ["status", "--short"]
                    }
                }
            }),
        )
        .expect("tool event");

        assert_eq!(event.kind, ExternalAiRunEventKind::ToolCall);
        assert!(event.message.contains("Run git status"));
        assert!(event.message.contains("git status --short"));
    }

    #[test]
    fn normalizes_shell_command_array_without_raw_json() {
        let event = normalize_session_update(
            &prompt_request(),
            &json!({
                "sessionId": "session-1",
                "update": {
                    "sessionUpdate": "tool_call",
                    "toolCallId": "tool-1",
                    "title": "git diff --stat",
                    "kind": "execute",
                    "status": "in_progress",
                    "rawInput": {
                        "call_id": "call_1",
                        "command": ["/bin/zsh", "-lc", "git diff --stat HEAD -- src/app.ts"],
                        "cwd": "/repo"
                    }
                }
            }),
        )
        .expect("tool event");

        assert!(event.message.contains("git diff --stat HEAD -- src/app.ts"));
        assert!(!event.message.contains("call_id"));
        assert!(!event.message.contains("/bin/zsh"));
    }

    #[test]
    fn normalizes_completed_tool_output_without_raw_json() {
        let event = normalize_session_update(
            &prompt_request(),
            &json!({
                "sessionId": "session-1",
                "update": {
                    "sessionUpdate": "tool_call_update",
                    "toolCallId": "tool-1",
                    "title": "completed",
                    "rawOutput": {
                        "aggregated_output": "src/app.ts | 12 ++++++\n1 file changed, 12 insertions(+)",
                        "call_id": "call_1",
                        "command": ["/bin/zsh", "-lc", "git diff --stat HEAD -- src/app.ts"],
                        "process_id": 123
                    }
                }
            }),
        )
        .expect("tool update");

        assert_eq!(event.kind, ExternalAiRunEventKind::ToolCallUpdate);
        assert!(event.message.contains("completed"));
        assert!(event.message.contains("git diff --stat HEAD -- src/app.ts"));
        assert!(event.message.contains("1 file changed"));
        assert!(!event.message.contains("aggregated_output"));
        assert!(!event.message.contains("call_id"));
        assert!(!event.message.contains("process_id"));
    }

    #[test]
    fn permission_request_allows_read_only_execute_tool_call() {
        let params = json!({
            "toolCall": {
                "kind": "execute",
                "rawInput": {
                    "command": "git",
                    "args": ["diff", "--stat"]
                }
            },
            "options": [
                { "optionId": "allow-once", "kind": "allow_once" },
                { "optionId": "reject-once", "kind": "reject_once" }
            ]
        });

        assert!(permission_request_is_read_only_terminal(&params));
        assert_eq!(
            permission_allow_outcome(&params),
            Some(json!({
                "outcome": "selected",
                "optionId": "allow-once"
            }))
        );
    }

    #[test]
    fn normalizes_plan_update() {
        let event = normalize_session_update(
            &prompt_request(),
            &json!({
                "sessionId": "session-1",
                "update": {
                    "sessionUpdate": "plan",
                    "entries": [
                        {
                            "content": "Read diff",
                            "priority": "high",
                            "status": "in_progress"
                        }
                    ]
                }
            }),
        )
        .expect("plan event");

        assert_eq!(event.kind, ExternalAiRunEventKind::Plan);
        assert_eq!(event.message, "in_progress: Read diff");
    }

    #[test]
    fn permission_denial_prefers_reject_option() {
        let outcome = permission_denial_outcome(&json!({
            "options": [
                { "optionId": "allow-once", "kind": "allow_once" },
                { "optionId": "reject-once", "kind": "reject_once" }
            ]
        }));

        assert_eq!(
            outcome,
            json!({
                "outcome": "selected",
                "optionId": "reject-once"
            })
        );
    }

    #[test]
    fn idle_timeout_message_points_to_connection_loss() {
        let message = external_agent_idle_timeout_message();

        assert!(message.contains("stalled"));
        assert!(message.contains("internet connection"));
        assert!(message.contains(&EXTERNAL_AGENT_IDLE_TIMEOUT.as_secs().to_string()));
    }

    #[test]
    fn scoped_file_read_allows_repo_file() {
        let temp_dir = tempfile::tempdir().expect("temp repo");
        let file_path = temp_dir.path().join("README.md");
        fs::write(&file_path, "one\ntwo\nthree\n").expect("write file");
        let repo_root = fs::canonicalize(temp_dir.path()).expect("canonical repo");

        let content =
            read_repo_text_file(&repo_root, &file_path.to_string_lossy(), Some(2), Some(1))
                .expect("read repo file");

        assert_eq!(content, "two");
    }

    #[test]
    fn scoped_file_read_rejects_outside_file() {
        let repo_dir = tempfile::tempdir().expect("temp repo");
        let outside_dir = tempfile::tempdir().expect("outside temp");
        let outside_file = outside_dir.path().join("secret.txt");
        fs::write(&outside_file, "secret").expect("write file");
        let repo_root = fs::canonicalize(repo_dir.path()).expect("canonical repo");

        let error = read_repo_text_file(&repo_root, &outside_file.to_string_lossy(), None, None)
            .expect_err("reject outside file");

        assert!(error.contains("outside the active repository"));
    }
}
