use super::terminal::is_read_only_terminal_command;
use serde_json::{json, Value};

pub(super) fn permission_denial_outcome(params: &Value) -> Value {
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

pub(super) fn permission_allow_outcome(params: &Value) -> Option<Value> {
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

pub(super) fn permission_request_is_read_only_terminal(params: &Value) -> bool {
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
