use super::external_agents::{external_agent_command, external_agent_status};
use super::types::{
    ExternalAiAgentConfigOption, ExternalAiAgentSessionConfig, ExternalAiAgentSessionConfigRequest,
    ExternalAiAgentStatusState, ExternalAiPromptRequest, ExternalAiPromptResponse,
    ExternalAiRunEvent, ExternalAiRunEventKind, LocalAiActionKind, LocalAiRunProgress,
    LocalAiRunProgressState, EXTERNAL_AI_RUN_EVENT, LOCAL_AI_RUN_PROGRESS_EVENT,
};
mod events;
mod filesystem;
mod permissions;
mod session_config;
mod terminal;
use events::normalize_session_update;
use filesystem::read_repo_text_file;
use once_cell::sync::Lazy;
use permissions::{
    permission_allow_outcome, permission_denial_outcome, permission_request_is_read_only_terminal,
};
use serde::Deserialize;
use serde_json::{json, Value};
use session_config::session_config_options;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use terminal::{
    parse_terminal_create_request, prepare_terminal_command, spawn_terminal_session,
    terminal_command_display, terminal_id_param, terminal_output_snapshot,
    terminal_try_exit_status, TerminalSession,
};

const ACP_PROTOCOL_VERSION: u16 = 1;
const JSON_RPC_VERSION: &str = "2.0";
const EXTERNAL_AGENT_IDLE_TIMEOUT: Duration = Duration::from_secs(90);

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
        match (message.id, message.method, message.params) {
            (None, Some(method), params) => self.handle_notification(&method, params),
            (Some(id), Some(method), params) => self.handle_client_request(id, &method, params),
            _ => Ok(()),
        }
    }

    fn handle_notification(&mut self, method: &str, params: Option<Value>) -> Result<(), String> {
        if method != "session/update" {
            return Ok(());
        }

        let Some(params) = params else {
            return Ok(());
        };
        self.emit_session_update(&params);
        Ok(())
    }

    fn emit_session_update(&mut self, params: &Value) {
        if let Some(event) = normalize_session_update(&self.request, params) {
            if event.kind == ExternalAiRunEventKind::Text {
                self.transcript.push_str(&event.message);
            }
            let kind = event.kind;
            let message = event.message.clone();
            let _ = self.app.emit(EXTERNAL_AI_RUN_EVENT, event);
            emit_compatible_run_progress(&self.app, &self.request, kind, message);
        }
    }

    fn handle_client_request(
        &mut self,
        id: Value,
        method: &str,
        params: Option<Value>,
    ) -> Result<(), String> {
        match (method, params) {
            ("fs/read_text_file", Some(params)) => self.handle_read_text_file(id, params),
            ("fs/write_text_file", params) => self.deny_file_write(id, params),
            ("session/request_permission", Some(params)) => {
                self.handle_permission_request(id, params)
            }
            (method, params) if method.starts_with("terminal/") => {
                self.handle_terminal_request(id, method, params)
            }
            (method, _) => self.respond_error(
                id,
                -32601,
                &format!("Unsupported ACP client method: {}", method),
            ),
        }
    }

    fn handle_terminal_request(
        &mut self,
        id: Value,
        method: &str,
        params: Option<Value>,
    ) -> Result<(), String> {
        match (method, params) {
            ("terminal/create", Some(params)) => self.handle_terminal_create(id, params),
            ("terminal/output", Some(params)) => self.handle_terminal_output(id, params),
            ("terminal/wait_for_exit", Some(params)) => {
                self.handle_terminal_wait_for_exit(id, params)
            }
            ("terminal/kill", Some(params)) => self.handle_terminal_kill(id, params),
            ("terminal/release", Some(params)) => self.handle_terminal_release(id, params),
            (method, params) => {
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
        }
    }

    fn deny_file_write(&mut self, id: Value, params: Option<Value>) -> Result<(), String> {
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
        let request = parse_terminal_create_request(&params, &self.repo_root)?;

        if !request.cwd.starts_with(&self.repo_root) {
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

        let Some(prepared_command) = prepare_terminal_command(&request.command, &request.args)
        else {
            let display = terminal_command_display(&request.command, &request.args);
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

        let terminal_id = self.next_terminal_id();
        let terminal_session = spawn_terminal_session(
            &request,
            &prepared_command,
            self.app.clone(),
            self.request.clone(),
            &terminal_id,
        )?;

        self.emit_event(
            ExternalAiRunEventKind::ToolCall,
            format!(
                "{}\n{}",
                request.cwd.to_string_lossy(),
                prepared_command.display
            ),
            Some(json!({
                "terminalId": terminal_id,
                "command": prepared_command.program,
                "args": prepared_command.args,
                "cwd": request.cwd.to_string_lossy(),
            })),
        );
        self.terminals.insert(terminal_id.clone(), terminal_session);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compatible_progress_hides_raw_text_chunks() {
        let message = compatible_progress_message(ExternalAiRunEventKind::Text, "{\"summary\"");

        assert_eq!(message, "Receiving external agent response");
    }

    #[test]
    fn idle_timeout_message_points_to_connection_loss() {
        let message = external_agent_idle_timeout_message();

        assert!(message.contains("stalled"));
        assert!(message.contains("internet connection"));
        assert!(message.contains(&EXTERNAL_AGENT_IDLE_TIMEOUT.as_secs().to_string()));
    }
}
