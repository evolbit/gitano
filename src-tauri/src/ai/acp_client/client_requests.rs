use super::events::normalize_session_update;
use super::filesystem::read_repo_text_file;
use super::permissions::{
    permission_allow_outcome, permission_denial_outcome, permission_request_is_read_only_terminal,
};
use super::terminal::{
    parse_terminal_create_request, prepare_terminal_command, spawn_terminal_session,
    terminal_command_display, terminal_id_param, terminal_output_snapshot,
    terminal_try_exit_status,
};
use super::transport::RpcMessage;
use super::{emit_compatible_run_progress, AcpProcessClient};
use crate::ai::types::{ExternalAiRunEventKind, EXTERNAL_AI_RUN_EVENT};
use serde_json::{json, Value};
use tauri::Emitter;

impl AcpProcessClient {
    pub(super) fn handle_message(&mut self, message: RpcMessage) -> Result<(), String> {
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

    fn next_terminal_id(&mut self) -> String {
        let id = self.next_terminal_id;
        self.next_terminal_id += 1;
        format!("gitano-terminal-{}", id)
    }
}
