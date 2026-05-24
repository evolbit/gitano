use super::super::types::{ExternalAiPromptRequest, ExternalAiRunEvent, ExternalAiRunEventKind};
use super::terminal::{command_name, terminal_command_display};
use serde_json::Value;

pub(super) fn normalize_session_update(
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
    if let Some(command_text) = command.as_str() {
        let args = args.and_then(string_array).unwrap_or_default();
        return Some(shell_command_display(command_text, &args));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::types::LocalAiActionKind;
    use serde_json::json;
    use std::collections::HashMap;

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
}
