use super::external_agents::{external_agent_command, external_agent_status};
use super::types::{
    ExternalAiAgentConfigOption, ExternalAiAgentSessionConfig, ExternalAiAgentSessionConfigRequest,
    ExternalAiAgentStatusState, ExternalAiPromptRequest, ExternalAiPromptResponse,
    ExternalAiRunEvent, ExternalAiRunEventKind, LocalAiActionKind, LocalAiRunProgress,
    LocalAiRunProgressState, EXTERNAL_AI_RUN_EVENT, LOCAL_AI_RUN_PROGRESS_EVENT,
};
mod client_requests;
mod events;
mod filesystem;
mod permissions;
mod session_config;
mod terminal;
use once_cell::sync::Lazy;
mod transport;
use serde_json::{json, Value};
use session_config::{mode_value_key, session_config_options};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use terminal::TerminalSession;
use transport::{spawn_stdout_reader, write_message, RpcLineReceiver};

const ACP_PROTOCOL_VERSION: u16 = 1;
const JSON_RPC_VERSION: &str = "2.0";
const EXTERNAL_AGENT_IDLE_TIMEOUT: Duration = Duration::from_secs(90);
const COPILOT_AGENT_ID: &str = "github-copilot-cli";
const STRUCTURED_OUTPUT_RETRY_PROMPT: &str = "Your previous response did not include Gitano's required structured JSON result. Use the response shape and task instructions from the previous prompt. Return the final answer now as one valid JSON object only. Do not include markdown fences, prose, progress text, status text, tool plans, or tool calls.";

static ACTIVE_RUNS: Lazy<Mutex<HashMap<String, ActiveRun>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
struct ActiveRun {
    session_id: Option<String>,
    writer: Arc<Mutex<ChildStdin>>,
}

struct AcpProcessClient {
    app: AppHandle,
    request: ExternalAiPromptRequest,
    repo_root: PathBuf,
    child: Child,
    writer: Arc<Mutex<ChildStdin>>,
    stdout_lines: RpcLineReceiver,
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
    client.apply_default_action_mode(&session)?;
    let mut stop_reason = client.prompt(&session.session_id)?;
    if should_retry_structured_response(&client.transcript, &stop_reason) {
        client.emit_event(
            ExternalAiRunEventKind::Thought,
            "External agent ended without structured JSON; requesting final JSON result."
                .to_string(),
            None,
        );
        stop_reason = client.prompt_text(&session.session_id, STRUCTURED_OUTPUT_RETRY_PROMPT)?;
    }
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
        let agent_command = external_agent_command(&request.agent_id)?;
        let mut command = Command::new(&agent_command.program);
        command
            .args(agent_command.args)
            .current_dir(&repo_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(path_env) = agent_command.path_env {
            command.env("PATH", path_env);
        }

        let mut child = command
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
            if config_id == "mode" {
                continue;
            }

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

    fn apply_default_action_mode(&mut self, session: &AcpSession) -> Result<(), String> {
        if self.request.agent_id != COPILOT_AGENT_ID {
            return Ok(());
        }

        let Some(default_mode) = copilot_default_action_mode(session) else {
            return Ok(());
        };

        let result = match default_mode {
            DefaultActionMode::ConfigOption { config_id, value } => self.call(
                "session/set_config_option",
                json!({
                    "sessionId": session.session_id.as_str(),
                    "configId": config_id,
                    "value": value,
                }),
            ),
            DefaultActionMode::LegacyMode(value) => self.call(
                "session/set_mode",
                json!({
                    "sessionId": session.session_id.as_str(),
                    "modeId": value,
                }),
            ),
        };

        if let Err(error) = result {
            self.emit_event(
                ExternalAiRunEventKind::Thought,
                format!("External agent default mode was not applied: {}", error),
                None,
            );
        }

        Ok(())
    }

    fn prompt(&mut self, session_id: &str) -> Result<String, String> {
        let prompt = self.request.prompt.clone();
        self.prompt_text(session_id, &prompt)
    }

    fn prompt_text(&mut self, session_id: &str, prompt: &str) -> Result<String, String> {
        let result = self.call(
            "session/prompt",
            json!({
                "sessionId": session_id,
                "prompt": [
                    {
                        "type": "text",
                        "text": prompt
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

enum DefaultActionMode {
    ConfigOption { config_id: String, value: String },
    LegacyMode(String),
}

fn copilot_default_action_mode(session: &AcpSession) -> Option<DefaultActionMode> {
    let mode_option = session
        .config_options
        .iter()
        .find(|option| option.id == "mode" || option.category.as_deref() == Some("mode"));

    if let Some(option) = mode_option {
        if !is_plan_mode(&option.current_value) {
            return None;
        }

        return preferred_non_plan_mode(option.options.iter().map(|option| option.value.as_str()))
            .map(|value| DefaultActionMode::ConfigOption {
                config_id: option.id.clone(),
                value,
            });
    }

    if session.mode_config_fallback {
        return Some(DefaultActionMode::LegacyMode("agent".to_string()));
    }

    None
}

fn preferred_non_plan_mode<'a>(values: impl Iterator<Item = &'a str>) -> Option<String> {
    let values = values.collect::<Vec<_>>();
    for preferred in ["agent", "interactive", "code"] {
        if let Some(value) = values
            .iter()
            .find(|value| mode_value_key(value.as_ref()) == preferred)
        {
            return Some((*value).to_string());
        }
    }

    values
        .into_iter()
        .find(|value| !is_plan_mode(value) && !is_autopilot_mode(value))
        .map(ToString::to_string)
}

fn is_plan_mode(value: &str) -> bool {
    matches!(mode_value_key(value).as_str(), "plan" | "architect")
}

fn is_autopilot_mode(value: &str) -> bool {
    mode_value_key(value) == "autopilot"
}

fn should_retry_structured_response(transcript: &str, stop_reason: &str) -> bool {
    let trimmed = transcript.trim();
    stop_reason == "end_turn" && !trimmed.starts_with("Error:") && !trimmed.contains('{')
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

    #[test]
    fn structured_response_retry_runs_for_empty_end_turn() {
        assert!(should_retry_structured_response("", "end_turn"));
    }

    #[test]
    fn structured_response_retry_skips_json_and_errors() {
        assert!(!should_retry_structured_response(
            "{\"summary\":\"ok\"}",
            "end_turn"
        ));
        assert!(!should_retry_structured_response(
            "Error: not authorized",
            "end_turn"
        ));
        assert!(!should_retry_structured_response("", "max_tokens"));
    }

    #[test]
    fn copilot_default_action_mode_prefers_agent_when_current_mode_is_plan() {
        let session = AcpSession {
            session_id: "session-1".to_string(),
            mode_config_fallback: false,
            config_options: vec![ExternalAiAgentConfigOption {
                id: "mode".to_string(),
                name: "Mode".to_string(),
                description: None,
                category: Some("mode".to_string()),
                option_type: "select".to_string(),
                current_value: "https://agentclientprotocol.com/protocol/session-modes#plan"
                    .to_string(),
                options: vec![
                    super::super::types::ExternalAiAgentConfigOptionValue {
                        value: "https://agentclientprotocol.com/protocol/session-modes#plan"
                            .to_string(),
                        name: "Plan".to_string(),
                        description: None,
                    },
                    super::super::types::ExternalAiAgentConfigOptionValue {
                        value: "https://agentclientprotocol.com/protocol/session-modes#agent"
                            .to_string(),
                        name: "Agent".to_string(),
                        description: None,
                    },
                ],
            }],
        };

        match copilot_default_action_mode(&session) {
            Some(DefaultActionMode::ConfigOption { config_id, value }) => {
                assert_eq!(config_id, "mode");
                assert_eq!(
                    value,
                    "https://agentclientprotocol.com/protocol/session-modes#agent"
                );
            }
            _ => panic!("expected config mode"),
        }
    }

    #[test]
    fn copilot_default_action_mode_does_not_select_autopilot() {
        let session = AcpSession {
            session_id: "session-1".to_string(),
            mode_config_fallback: false,
            config_options: vec![ExternalAiAgentConfigOption {
                id: "mode".to_string(),
                name: "Mode".to_string(),
                description: None,
                category: Some("mode".to_string()),
                option_type: "select".to_string(),
                current_value: "https://agentclientprotocol.com/protocol/session-modes#plan"
                    .to_string(),
                options: vec![
                    super::super::types::ExternalAiAgentConfigOptionValue {
                        value: "https://agentclientprotocol.com/protocol/session-modes#plan"
                            .to_string(),
                        name: "Plan".to_string(),
                        description: None,
                    },
                    super::super::types::ExternalAiAgentConfigOptionValue {
                        value: "https://agentclientprotocol.com/protocol/session-modes#autopilot"
                            .to_string(),
                        name: "Autopilot".to_string(),
                        description: None,
                    },
                ],
            }],
        };

        assert!(copilot_default_action_mode(&session).is_none());
    }

    #[test]
    fn copilot_default_action_mode_preserves_non_plan_current_mode() {
        let session = AcpSession {
            session_id: "session-1".to_string(),
            mode_config_fallback: false,
            config_options: vec![ExternalAiAgentConfigOption {
                id: "mode".to_string(),
                name: "Mode".to_string(),
                description: None,
                category: Some("mode".to_string()),
                option_type: "select".to_string(),
                current_value: "agent".to_string(),
                options: Vec::new(),
            }],
        };

        assert!(copilot_default_action_mode(&session).is_none());
    }
}
