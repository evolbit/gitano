use super::{
    external_agent_idle_timeout_message, AcpProcessClient, EXTERNAL_AGENT_IDLE_TIMEOUT,
    JSON_RPC_VERSION,
};
use crate::ai::types::ExternalAiRunEventKind;
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::process::{ChildStdin, ChildStdout};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex};

pub(super) type RpcLineReceiver = Receiver<Result<String, String>>;

#[derive(Debug, Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct RpcMessage {
    #[serde(default)]
    pub(super) id: Option<Value>,
    #[serde(default)]
    pub(super) method: Option<String>,
    #[serde(default)]
    pub(super) params: Option<Value>,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<RpcError>,
}

impl AcpProcessClient {
    pub(super) fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
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

    pub(super) fn respond_result(&mut self, id: Value, result: Value) -> Result<(), String> {
        write_message(
            &self.writer,
            &json!({
                "jsonrpc": JSON_RPC_VERSION,
                "id": id,
                "result": result,
            }),
        )
    }

    pub(super) fn respond_error(
        &mut self,
        id: Value,
        code: i64,
        message: &str,
    ) -> Result<(), String> {
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
}

pub(super) fn spawn_stdout_reader(stdout: ChildStdout) -> RpcLineReceiver {
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

pub(super) fn write_message(
    writer: &Arc<Mutex<ChildStdin>>,
    message: &Value,
) -> Result<(), String> {
    let mut writer = writer.lock().map_err(|e| e.to_string())?;
    let line = serde_json::to_string(message).map_err(|e| e.to_string())?;
    writer
        .write_all(line.as_bytes())
        .and_then(|_| writer.write_all(b"\n"))
        .and_then(|_| writer.flush())
        .map_err(|e| format!("External agent transport write failed: {}", e))
}
