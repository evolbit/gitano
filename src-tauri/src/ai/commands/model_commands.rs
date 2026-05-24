use super::super::entitlement::{ensure_entitled, entitlement_status};
use super::super::machine::{compatibility_for_model, machine_profile};
use super::super::models::{
    load_preferences, model_catalog, reconcile_preferences_after_model_delete,
    reconcile_preferences_with_available_models, set_action_prompt_override,
    set_analysis_engine_preference, set_first_downloaded_model_as_global_default,
    set_model_preference, set_warm_model_preference, NO_AI_MODELS_AVAILABLE_MESSAGE,
};
use super::super::ollama::{emit_failed_progress, OllamaClient};
use super::super::runtime::{ensure_runtime_ready, start_managed_runtime_if_installed};
use super::super::types::{
    AnalysisEngine, LocalAiCompatibility, LocalAiCompatibilityLevel, LocalAiEntitlementStatus,
    LocalAiMachineProfile, LocalAiModelEntry, LocalAiModelStatus, LocalAiPreferences,
    LocalAiPrepareModelRequest, LocalAiPrepareModelResponse, LocalAiSetActionPromptOverrideRequest,
    LocalAiSetAnalysisEnginePreferenceRequest, LocalAiSetModelPreferenceRequest,
    LocalAiSetModelWarmPreferenceRequest, LocalAiWarmModelsResponse,
};
use super::model_helpers::{
    ensure_supported_model, keep_alive_duration, operation_id, planned_runtime_status,
};
use super::warm_models::{unload_model_if_runtime_available, warm_configured_models};
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
pub async fn ai_get_model_preferences() -> LocalAiPreferences {
    let preferences = load_preferences();
    let Ok(available_model_ids) = OllamaClient::from_env()
        .installed_supported_model_ids()
        .await
    else {
        return preferences;
    };

    reconcile_preferences_with_available_models(&available_model_ids).unwrap_or(preferences)
}

#[tauri::command]
pub fn ai_set_model_preference(
    request: LocalAiSetModelPreferenceRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    set_model_preference(
        request.model_id.as_deref().unwrap_or(""),
        request.action_kind,
    )
}

#[tauri::command]
pub async fn ai_set_analysis_engine_preference(
    request: LocalAiSetAnalysisEnginePreferenceRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    if let AnalysisEngine::ExternalAgent { agent_id } = &request.engine {
        super::super::external_agents::external_agent_status(agent_id)?;
    }
    let was_local = load_preferences().analysis_engine.is_local_model();
    let next_is_external = request.engine.is_external_agent();
    let warm_model_ids = if was_local && next_is_external {
        load_preferences().warm_model_ids
    } else {
        Vec::new()
    };

    let preferences = set_analysis_engine_preference(request.engine, request.action_kind)?;

    for model_id in warm_model_ids {
        let _ = unload_model_if_runtime_available(&model_id).await;
    }

    Ok(preferences)
}

#[tauri::command]
pub fn ai_set_action_prompt_override(
    request: LocalAiSetActionPromptOverrideRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    set_action_prompt_override(request.action_kind, request.prompt.as_deref())
}

#[tauri::command]
pub async fn ai_set_model_warm_preference(
    request: LocalAiSetModelWarmPreferenceRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    let model = ensure_supported_model(&request.model_id)?;

    let client = OllamaClient::from_env();
    if request.warm {
        start_managed_runtime_if_installed().await?;
        let status = client.model_status(&request.model_id).await;
        if !status.runtime.available {
            return Err(status
                .runtime
                .error
                .unwrap_or_else(|| "Local AI runtime is unavailable.".to_string()));
        }
        if !status.ready {
            return Err(format!(
                "Download {} before keeping it warm.",
                model.display_name
            ));
        }
    }

    let preferences = set_warm_model_preference(&request.model_id, request.warm)?;

    if request.warm {
        client
            .warm_model(&request.model_id, &keep_alive_duration(&preferences))
            .await?;
    } else {
        unload_model_if_runtime_available(&request.model_id).await?;
    }

    Ok(preferences)
}

#[tauri::command]
pub fn ai_get_machine_profile() -> LocalAiMachineProfile {
    machine_profile()
}

#[tauri::command]
pub async fn ai_get_model_status(model_id: Option<String>) -> Result<LocalAiModelStatus, String> {
    let model_id = model_id
        .filter(|model_id| !model_id.trim().is_empty())
        .or_else(|| {
            let global_model_id = load_preferences().global_model_id;
            if global_model_id.trim().is_empty() {
                None
            } else {
                Some(global_model_id)
            }
        })
        .ok_or_else(|| NO_AI_MODELS_AVAILABLE_MESSAGE.to_string())?;
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
            super::super::types::LocalAiCompatibilityLevel::Limited
                | super::super::types::LocalAiCompatibilityLevel::LikelyTooLarge
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
            let had_downloaded_models = pull_client
                .installed_supported_model_ids()
                .await
                .map(|model_ids| !model_ids.is_empty())
                .unwrap_or(false);
            pull_client
                .pull_model(
                    pull_app.clone(),
                    pull_operation_id.clone(),
                    model_id.clone(),
                )
                .await?;
            set_first_downloaded_model_as_global_default(&model_id, had_downloaded_models)?;
            Ok(())
        }
        .await
        {
            emit_failed_progress(&pull_app, pull_operation_id, model_id, error);
        }
    });

    Ok(LocalAiPrepareModelResponse { operation_id })
}

#[tauri::command]
pub async fn ai_delete_model(model_id: String) -> Result<(), String> {
    ensure_entitled()?;
    ensure_supported_model(&model_id)?;
    start_managed_runtime_if_installed().await?;
    let client = OllamaClient::from_env();
    let status = client.model_status(&model_id).await;

    if !status.runtime.available {
        return Err(status
            .runtime
            .error
            .unwrap_or_else(|| "Local AI runtime is unavailable.".to_string()));
    }

    client.delete_model(&model_id).await?;
    let remaining_model_ids = client
        .installed_supported_model_ids()
        .await
        .unwrap_or_default();
    reconcile_preferences_after_model_delete(&model_id, &remaining_model_ids)?;
    Ok(())
}

#[tauri::command]
pub async fn ai_warm_configured_models() -> Result<LocalAiWarmModelsResponse, String> {
    ensure_entitled()?;
    warm_configured_models().await
}

pub async fn warm_configured_models_background() {
    if ensure_entitled().is_err() {
        return;
    }

    let _ = warm_configured_models().await;
}
