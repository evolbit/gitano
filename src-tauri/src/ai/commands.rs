use super::cache::{build_cache_key, get_cached_result, put_cached_result};
use super::entitlement::{ensure_entitled, entitlement_status};
use super::git_context::{
    build_commit_analysis_context, build_git_context, LocalAiCommitAnalysisContextStep,
};
use super::machine::{compatibility_for_model, machine_profile};
use super::models::{
    find_model, load_preferences, model_catalog, reconcile_preferences_after_model_delete,
    reconcile_preferences_with_available_models, resolve_model_id,
    set_first_downloaded_model_as_global_default, set_model_preference, set_warm_model_preference,
    NO_AI_MODELS_AVAILABLE_MESSAGE,
};
use super::ollama::{emit_failed_progress, OllamaClient};
use super::prompts::{build_prompt, parse_structured_result, PROMPT_VERSION};
use super::runtime::{
    ensure_runtime_ready, latest_compatible_runtime_version, managed_runtime_supported,
    managed_runtime_version, prepare_managed_runtime, start_managed_runtime_if_installed,
    using_external_ollama,
};
use super::types::{
    LocalAiCompatibility, LocalAiCompatibilityLevel, LocalAiEntitlementStatus,
    LocalAiMachineProfile, LocalAiModelEntry, LocalAiModelStatus, LocalAiPreferences,
    LocalAiPrepareModelRequest, LocalAiPrepareModelResponse, LocalAiPrepareRuntimeRequest,
    LocalAiPrepareRuntimeResponse, LocalAiRunProgress, LocalAiRunProgressState, LocalAiRunRequest,
    LocalAiRunResult, LocalAiRuntimeSetupStatus, LocalAiRuntimeStatus,
    LocalAiSetModelPreferenceRequest, LocalAiSetModelWarmPreferenceRequest,
    LocalAiWarmModelFailure, LocalAiWarmModelsResponse, LOCAL_AI_RUN_PROGRESS_EVENT,
};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

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
pub async fn ai_get_runtime_status() -> Result<LocalAiRuntimeSetupStatus, String> {
    let client = OllamaClient::from_env();
    let runtime = client.runtime_status().await;
    let managed = !using_external_ollama();
    let installed = if managed {
        super::runtime::managed_runtime_binary_path().is_some()
    } else {
        runtime.available
    };

    Ok(LocalAiRuntimeSetupStatus {
        runtime,
        managed,
        installed,
        installed_version: if managed {
            managed_runtime_version()
        } else {
            None
        },
        latest_compatible_version: latest_compatible_runtime_version(),
        model_storage_path: machine_profile().model_storage_path,
        can_install: managed && managed_runtime_supported(),
    })
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
pub async fn ai_prepare_runtime(
    app: AppHandle,
    request: LocalAiPrepareRuntimeRequest,
) -> Result<LocalAiPrepareRuntimeResponse, String> {
    ensure_entitled()?;
    let operation_id = operation_id("runtime");
    let runtime_app = app.clone();
    let runtime_operation_id = operation_id.clone();

    tauri::async_runtime::spawn(async move {
        if let Err(error) =
            prepare_managed_runtime(&runtime_app, &runtime_operation_id, request.force_reinstall)
                .await
        {
            emit_failed_progress(
                &runtime_app,
                runtime_operation_id,
                "runtime".to_string(),
                error,
            );
        }
    });

    Ok(LocalAiPrepareRuntimeResponse { operation_id })
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

#[tauri::command]
pub async fn ai_run_action(
    app: AppHandle,
    request: LocalAiRunRequest,
) -> Result<LocalAiRunResult, String> {
    let result = run_action_inner(&app, &request).await;
    if let Err(error) = &result {
        emit_run_progress(
            &app,
            &request,
            LocalAiRunProgressState::Failed,
            "Analysis failed",
            Some(error.clone()),
        );
    }

    result
}

async fn run_action_inner(
    app: &AppHandle,
    request: &LocalAiRunRequest,
) -> Result<LocalAiRunResult, String> {
    ensure_entitled()?;
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::ResolvingCommit,
        "Resolving commit",
        None,
    );
    start_managed_runtime_if_installed().await?;
    let client = OllamaClient::from_env();
    let runtime = client.runtime_status().await;

    if !runtime.available {
        return Err(runtime
            .error
            .unwrap_or_else(|| "Ollama runtime is unavailable.".to_string()));
    }

    let available_model_ids = client.installed_supported_model_ids().await?;
    if available_model_ids.is_empty() {
        return Err(NO_AI_MODELS_AVAILABLE_MESSAGE.to_string());
    }
    let preferences = reconcile_preferences_with_available_models(&available_model_ids)?;

    let model_id = resolve_model_id(request.action_kind, request.model_id.as_deref())?;
    let model = ensure_supported_model(&model_id)?;
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
    let git_context = if request.action_kind == super::types::LocalAiActionKind::CommitAnalysis {
        let sha = request
            .commit_sha
            .as_deref()
            .ok_or_else(|| "Commit SHA is required for commit analysis.".to_string())?;
        build_commit_analysis_context(&request.repo_path, sha, model.context_window, |step| {
            emit_context_progress(app, request, step);
        })?
    } else {
        build_git_context(request, model.context_window)?
    };
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::CheckingCache,
        if request.force_refresh {
            "Bypassing cached analysis"
        } else {
            "Checking cache"
        },
        None,
    );
    let cache_key = build_cache_key(
        request.action_kind,
        PROMPT_VERSION,
        &model_digest,
        &request.repo_path,
        &git_context.input_digest,
    );

    if !request.force_refresh {
        if let Some(cached) = get_cached_result(&cache_key) {
            emit_run_progress(
                app,
                request,
                LocalAiRunProgressState::CacheHit,
                "Using cached analysis",
                None,
            );
            emit_run_progress(
                app,
                request,
                LocalAiRunProgressState::Completed,
                "Analysis complete",
                None,
            );
            return Ok(cached);
        }
    }

    let prompt = build_prompt(&git_context);
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::RunningModel,
        "Running local model",
        None,
    );
    let raw_response = client
        .generate_json(
            &model_id,
            &prompt,
            request.action_kind,
            model.context_window,
            &keep_alive_duration(&preferences),
        )
        .await?;
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::FormattingResult,
        "Formatting analysis",
        None,
    );
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
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::Completed,
        "Analysis complete",
        None,
    );
    Ok(result)
}

fn emit_context_progress(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    step: LocalAiCommitAnalysisContextStep,
) {
    match step {
        LocalAiCommitAnalysisContextStep::ResolvingCommit => emit_run_progress(
            app,
            request,
            LocalAiRunProgressState::ResolvingCommit,
            "Resolving commit",
            None,
        ),
        LocalAiCommitAnalysisContextStep::ReadingCommitDiff => emit_run_progress(
            app,
            request,
            LocalAiRunProgressState::ReadingCommitDiff,
            "Reading commit diff",
            None,
        ),
    }
}

fn emit_run_progress(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    state: LocalAiRunProgressState,
    message: &str,
    error: Option<String>,
) {
    if request.action_kind != super::types::LocalAiActionKind::CommitAnalysis {
        return;
    }

    let Some(run_id) = request.run_id.as_ref().filter(|run_id| !run_id.is_empty()) else {
        return;
    };

    let _ = app.emit(
        LOCAL_AI_RUN_PROGRESS_EVENT,
        LocalAiRunProgress {
            run_id: run_id.clone(),
            action_kind: request.action_kind,
            state,
            message: message.to_string(),
            error,
        },
    );
}

fn ensure_supported_model(model_id: &str) -> Result<LocalAiModelEntry, String> {
    find_model(model_id).ok_or_else(|| format!("Unsupported local AI model: {}", model_id))
}

async fn warm_configured_models() -> Result<LocalAiWarmModelsResponse, String> {
    start_managed_runtime_if_installed().await?;
    let client = OllamaClient::from_env();
    let runtime = client.runtime_status().await;

    if !runtime.available {
        return Err(runtime
            .error
            .unwrap_or_else(|| "Local AI runtime is unavailable.".to_string()));
    }

    let available_model_ids = client.installed_supported_model_ids().await?;
    let preferences = reconcile_preferences_with_available_models(&available_model_ids)?;
    let keep_alive = keep_alive_duration(&preferences);
    let mut warmed_model_ids = Vec::new();
    let mut failures = Vec::new();

    for model_id in preferences.warm_model_ids {
        if !available_model_ids
            .iter()
            .any(|available| available == &model_id)
        {
            continue;
        }

        match client.warm_model(&model_id, &keep_alive).await {
            Ok(()) => warmed_model_ids.push(model_id),
            Err(error) => failures.push(LocalAiWarmModelFailure { model_id, error }),
        }
    }

    Ok(LocalAiWarmModelsResponse {
        warmed_model_ids,
        failures,
    })
}

async fn unload_model_if_runtime_available(model_id: &str) -> Result<(), String> {
    start_managed_runtime_if_installed().await?;
    let client = OllamaClient::from_env();
    let status = client.model_status(model_id).await;

    if !status.runtime.available || !status.running {
        return Ok(());
    }

    client.unload_model(model_id).await
}

fn keep_alive_duration(preferences: &LocalAiPreferences) -> String {
    let minutes = preferences.keep_alive_minutes.clamp(1, 240);
    format!("{}m", minutes)
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

    #[test]
    fn keep_alive_duration_defaults_to_minutes() {
        let mut preferences = super::super::models::default_preferences();

        assert_eq!(keep_alive_duration(&preferences), "30m");

        preferences.keep_alive_minutes = 0;
        assert_eq!(keep_alive_duration(&preferences), "1m");
    }
}
