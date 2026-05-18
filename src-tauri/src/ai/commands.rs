use super::cache::{build_cache_key, get_cached_result, put_cached_result};
use super::entitlement::{ensure_entitled, entitlement_status};
use super::git_context::build_git_context;
use super::machine::{compatibility_for_model, machine_profile};
use super::models::{
    find_model, load_preferences, model_catalog, resolve_model_id, set_model_preference,
};
use super::ollama::{emit_failed_progress, OllamaClient};
use super::prompts::{build_prompt, parse_structured_result, PROMPT_VERSION};
use super::runtime::{ensure_runtime_ready, start_managed_runtime_if_installed};
use super::types::{
    LocalAiCompatibility, LocalAiCompatibilityLevel, LocalAiEntitlementStatus,
    LocalAiMachineProfile, LocalAiModelEntry, LocalAiModelStatus, LocalAiPreferences,
    LocalAiPrepareModelRequest, LocalAiPrepareModelResponse, LocalAiRunRequest, LocalAiRunResult,
    LocalAiRuntimeStatus, LocalAiSetModelPreferenceRequest,
};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

#[tauri::command]
pub fn ai_get_entitlement_status() -> LocalAiEntitlementStatus {
    entitlement_status()
}

#[tauri::command]
pub fn ai_get_model_catalog() -> Vec<LocalAiModelEntry> {
    model_catalog()
}

#[tauri::command]
pub fn ai_get_model_preferences() -> LocalAiPreferences {
    load_preferences()
}

#[tauri::command]
pub fn ai_set_model_preference(
    request: LocalAiSetModelPreferenceRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    set_model_preference(&request.model_id, request.action_kind)
}

#[tauri::command]
pub fn ai_get_machine_profile() -> LocalAiMachineProfile {
    machine_profile()
}

#[tauri::command]
pub async fn ai_get_model_status(model_id: Option<String>) -> Result<LocalAiModelStatus, String> {
    let model_id = model_id.unwrap_or_else(|| load_preferences().global_model_id);
    ensure_supported_model(&model_id)?;
    Ok(OllamaClient::from_env().model_status(&model_id).await)
}

#[tauri::command]
pub async fn ai_get_model_compatibility(model_id: String) -> Result<LocalAiCompatibility, String> {
    ensure_supported_model(&model_id)?;
    compatibility_for_model(&model_id, machine_profile(), planned_runtime_status())
}

#[tauri::command]
pub async fn ai_prepare_model(
    app: AppHandle,
    request: LocalAiPrepareModelRequest,
) -> Result<LocalAiPrepareModelResponse, String> {
    ensure_entitled()?;
    ensure_supported_model(&request.model_id)?;
    let client = OllamaClient::from_env();
    let compatibility = compatibility_for_model(
        &request.model_id,
        machine_profile(),
        planned_runtime_status(),
    )?;

    if compatibility.blocking
        && !matches!(
            compatibility.level,
            LocalAiCompatibilityLevel::RuntimeUnavailable
        )
    {
        return Err(compatibility
            .reasons
            .first()
            .cloned()
            .unwrap_or_else(|| "Selected local AI model cannot be prepared.".to_string()));
    }

    if !request.allow_limited
        && matches!(
            compatibility.level,
            super::types::LocalAiCompatibilityLevel::Limited
                | super::types::LocalAiCompatibilityLevel::LikelyTooLarge
        )
    {
        return Err(compatibility
            .reasons
            .first()
            .cloned()
            .unwrap_or_else(|| "Selected local AI model may run slowly.".to_string()));
    }

    let operation_id = operation_id(&request.model_id);
    let model_id = request.model_id.clone();
    let pull_client = client.clone();
    let pull_app = app.clone();
    let pull_operation_id = operation_id.clone();

    tauri::async_runtime::spawn(async move {
        if let Err(error) = async {
            ensure_runtime_ready(&pull_app, &pull_operation_id, &model_id).await?;
            pull_client
                .pull_model(
                    pull_app.clone(),
                    pull_operation_id.clone(),
                    model_id.clone(),
                )
                .await
        }
        .await
        {
            emit_failed_progress(&pull_app, pull_operation_id, model_id, error);
        }
    });

    Ok(LocalAiPrepareModelResponse { operation_id })
}

#[tauri::command]
pub async fn ai_run_action(request: LocalAiRunRequest) -> Result<LocalAiRunResult, String> {
    ensure_entitled()?;
    let model_id = resolve_model_id(request.action_kind, request.model_id.as_deref());
    let model = ensure_supported_model(&model_id)?;
    start_managed_runtime_if_installed().await?;
    let client = OllamaClient::from_env();
    let status = client.model_status(&model_id).await;

    if !status.runtime.available {
        return Err(status
            .runtime
            .error
            .unwrap_or_else(|| "Ollama runtime is unavailable.".to_string()));
    }

    if !status.ready {
        return Err(format!(
            "LOCAL_AI_MODEL_SETUP_REQUIRED: {} is not installed.",
            model_id
        ));
    }

    let model_digest = status
        .digest
        .clone()
        .unwrap_or_else(|| format!("{}:unknown-digest", model_id));
    let git_context = build_git_context(&request, model.context_window)?;
    let cache_key = build_cache_key(
        request.action_kind,
        PROMPT_VERSION,
        &model_digest,
        &request.repo_path,
        &git_context.input_digest,
    );

    if !request.force_refresh {
        if let Some(cached) = get_cached_result(&cache_key) {
            return Ok(cached);
        }
    }

    let prompt = build_prompt(&git_context);
    let raw_response = client
        .generate_json(
            &model_id,
            &prompt,
            request.action_kind,
            model.context_window,
        )
        .await?;
    let structured = parse_structured_result(request.action_kind, &raw_response)?;
    let result = LocalAiRunResult {
        action_kind: request.action_kind,
        model_id,
        model_digest,
        prompt_version: PROMPT_VERSION.to_string(),
        input_digest: git_context.input_digest,
        from_cache: false,
        metadata: git_context.metadata,
        result: structured,
    };

    put_cached_result(cache_key, &result)?;
    Ok(result)
}

fn ensure_supported_model(model_id: &str) -> Result<LocalAiModelEntry, String> {
    find_model(model_id).ok_or_else(|| format!("Unsupported local AI model: {}", model_id))
}

fn operation_id(model_id: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("local-ai-{}-{}", model_id.replace([':', '/'], "-"), now)
}

fn planned_runtime_status() -> LocalAiRuntimeStatus {
    LocalAiRuntimeStatus {
        available: true,
        endpoint: super::runtime::ollama_endpoint(),
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
    fn operation_ids_include_model_name() {
        let id = operation_id("qwen2.5-coder:7b");

        assert!(id.starts_with("local-ai-qwen2.5-coder-7b-"));
    }
}
