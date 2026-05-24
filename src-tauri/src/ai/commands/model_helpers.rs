use super::super::models::find_model;
use super::super::types::{
    LocalAiActionKind, LocalAiModelEntry, LocalAiPreferences, LocalAiRuntimeStatus,
};
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) fn ensure_supported_model(model_id: &str) -> Result<LocalAiModelEntry, String> {
    find_model(model_id).ok_or_else(|| format!("Unsupported local AI model: {}", model_id))
}

pub(super) fn ensure_model_supports_action(
    model: &LocalAiModelEntry,
    action_kind: LocalAiActionKind,
) -> Result<(), String> {
    if model.action_suitability.contains(&action_kind) {
        return Ok(());
    }

    Err(format!(
        "LOCAL_AI_MODEL_SETUP_REQUIRED: {} is not configured for {}. Select a model that supports this action.",
        model.display_name,
        action_kind.display_label()
    ))
}

pub(super) fn keep_alive_duration(preferences: &LocalAiPreferences) -> String {
    let minutes = preferences.keep_alive_minutes.clamp(1, 240);
    format!("{}m", minutes)
}

pub(super) fn operation_id(model_id: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("local-ai-{}-{}", model_id.replace([':', '/'], "-"), now)
}

pub(super) fn planned_runtime_status() -> LocalAiRuntimeStatus {
    LocalAiRuntimeStatus {
        available: true,
        endpoint: super::super::runtime::ollama_endpoint(),
        error: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsupported_models_at_command_boundary() {
        let error = ensure_supported_model("not-a-model").expect_err("unsupported model");

        assert!(error.contains("Unsupported local AI model"));
    }

    #[test]
    fn rejects_models_that_do_not_support_action_at_command_boundary() {
        let model = ensure_supported_model("qwen2.5-coder:3b").expect("model exists");

        let error = ensure_model_supports_action(&model, LocalAiActionKind::BranchReview)
            .expect_err("model should not support branch review");

        assert!(error.contains("LOCAL_AI_MODEL_SETUP_REQUIRED"));
        assert!(error.contains("Branch review"));
    }

    #[test]
    fn operation_ids_include_model_name() {
        let id = operation_id("qwen2.5-coder:7b");

        assert!(id.starts_with("local-ai-qwen2.5-coder-7b-"));
    }

    #[test]
    fn keep_alive_duration_defaults_to_minutes() {
        let mut preferences = super::super::super::models::default_preferences();

        assert_eq!(keep_alive_duration(&preferences), "30m");

        preferences.keep_alive_minutes = 0;
        assert_eq!(keep_alive_duration(&preferences), "1m");
    }
}
