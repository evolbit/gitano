use super::super::types::{ExternalAiAgentConfigOption, ExternalAiAgentConfigOptionValue};
use serde_json::Value;

pub(super) fn session_config_options(result: &Value) -> (Vec<ExternalAiAgentConfigOption>, bool) {
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
    let id = value.get("id")?.as_str()?.to_string();
    let category = value.get("category").and_then(Value::as_str);
    if config_option_requires_unsupported_client_service(&id, category) {
        return None;
    }

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
        id,
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

pub(super) fn config_option_requires_unsupported_client_service(
    id: &str,
    category: Option<&str>,
) -> bool {
    let normalized_id = id.trim();
    let normalized_category = category.map(str::trim);

    normalized_id == "allow_all"
        || matches!(
            normalized_category,
            Some("permission" | "permissions" | "tool_permissions")
        )
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
    fn filters_permission_service_config_options() {
        let (options, fallback) = session_config_options(&json!({
            "sessionId": "session-1",
            "configOptions": [
                {
                    "id": "allow_all",
                    "name": "Allow all",
                    "category": "permissions",
                    "type": "select",
                    "currentValue": "off",
                    "options": [
                        { "value": "off", "name": "Off" },
                        { "value": "on", "name": "On" }
                    ]
                },
                {
                    "id": "model",
                    "name": "Model",
                    "category": "model",
                    "type": "select",
                    "currentValue": "copilot-sonnet",
                    "options": [
                        { "value": "copilot-sonnet", "name": "Copilot Sonnet" }
                    ]
                }
            ]
        }));

        assert!(!fallback);
        assert_eq!(options.len(), 1);
        assert_eq!(options[0].id, "model");
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
}
