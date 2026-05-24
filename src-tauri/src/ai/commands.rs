use super::context_window::{effective_context_window, generation_context_window_for_prompt};
use super::entitlement::{ensure_entitled, entitlement_status};
use super::git_context::build_branch_review_file_contexts;
use super::machine::{compatibility_for_model, machine_profile};
use super::models::{
    external_agent_effective_option_values, load_preferences, model_catalog,
    reconcile_preferences_after_model_delete, reconcile_preferences_with_available_models,
    resolve_model_id, set_action_prompt_override, set_analysis_engine_preference,
    set_external_agent_config_preference, set_first_downloaded_model_as_global_default,
    set_model_preference, set_warm_model_preference, NO_AI_MODELS_AVAILABLE_MESSAGE,
};
use super::ollama::{emit_failed_progress, OllamaClient};
use super::prompts::{
    build_external_agent_prompt_with_instruction, build_prompt_with_instruction,
    effective_prompt_instruction, parse_structured_result, EXTERNAL_AGENT_PROMPT_VERSION,
    PROMPT_VERSION,
};
use super::runtime::{
    ensure_runtime_ready, latest_compatible_runtime_version, managed_runtime_supported,
    managed_runtime_version, prepare_managed_runtime, start_managed_runtime_if_installed,
    using_external_ollama,
};
use super::types::{
    AnalysisEngine, ExternalAiAgentCommandRequest, ExternalAiAgentConfigPreferenceRequest,
    ExternalAiAgentEntry, ExternalAiAgentInstallRequest, ExternalAiAgentInstallResponse,
    ExternalAiAgentSessionConfig, ExternalAiAgentSessionConfigRequest, ExternalAiAgentStatus,
    ExternalAiCancelRequest, ExternalAiPromptRequest, ExternalAiPromptResponse, LocalAiActionKind,
    LocalAiBranchReviewResult, LocalAiCompatibility, LocalAiCompatibilityLevel,
    LocalAiEntitlementStatus, LocalAiMachineProfile, LocalAiModelEntry, LocalAiModelStatus,
    LocalAiPreferences, LocalAiPrepareModelRequest, LocalAiPrepareModelResponse,
    LocalAiPrepareRuntimeRequest, LocalAiPrepareRuntimeResponse, LocalAiRunProgressState,
    LocalAiRunRequest, LocalAiRunResult, LocalAiRuntimeSetupStatus,
    LocalAiSetActionPromptOverrideRequest, LocalAiSetAnalysisEnginePreferenceRequest,
    LocalAiSetModelPreferenceRequest, LocalAiSetModelWarmPreferenceRequest,
    LocalAiStructuredResult, LocalAiWarmModelsResponse,
};
mod action_context;
mod branch_review;
mod external_agent;
mod model_helpers;
mod progress;
mod run_cache;
mod warm_models;
use action_context::{build_external_agent_context, build_local_action_context};
use branch_review::{merge_branch_review_blocks, BRANCH_REVIEW_PARALLEL_CALLS};
use external_agent::{
    external_agent_digest, external_unstructured_result, selected_external_agent_id,
};
use futures_util::{stream, StreamExt};
use model_helpers::{
    ensure_model_supports_action, ensure_supported_model, keep_alive_duration, operation_id,
    planned_runtime_status,
};
use progress::{emit_branch_context_progress, emit_run_progress, formatting_message};
use run_cache::{complete_run, prepare_run_cache, RunCacheRequest};
use tauri::AppHandle;
use warm_models::{unload_model_if_runtime_available, warm_configured_models};

struct LocalAiRunEnvironment {
    client: OllamaClient,
    preferences: LocalAiPreferences,
    model_id: String,
    model: LocalAiModelEntry,
    model_digest: String,
}

#[tauri::command]
pub fn ai_get_entitlement_status() -> LocalAiEntitlementStatus {
    entitlement_status()
}

#[tauri::command]
pub fn ai_get_model_catalog() -> Vec<LocalAiModelEntry> {
    model_catalog()
}

#[tauri::command]
pub fn ai_get_external_agent_catalog() -> Vec<ExternalAiAgentEntry> {
    super::external_agents::external_agent_catalog()
}

#[tauri::command]
pub fn ai_get_external_agent_status(agent_id: String) -> Result<ExternalAiAgentStatus, String> {
    super::external_agents::external_agent_status(&agent_id)
}

#[tauri::command]
pub async fn ai_get_external_agent_session_config(
    app: AppHandle,
    request: ExternalAiAgentSessionConfigRequest,
) -> Result<ExternalAiAgentSessionConfig, String> {
    ensure_entitled()?;
    super::acp_client::get_external_agent_session_config(app, request).await
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
        super::external_agents::external_agent_status(agent_id)?;
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
pub fn ai_set_external_agent_as_default(
    request: ExternalAiAgentCommandRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    super::external_agents::set_external_agent_as_default(request)
}

#[tauri::command]
pub fn ai_set_external_agent_config_preference(
    request: ExternalAiAgentConfigPreferenceRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    set_external_agent_config_preference(
        &request.agent_id,
        request.action_kind,
        &request.config_id,
        request.value.as_deref(),
    )
}

#[tauri::command]
pub fn ai_set_action_prompt_override(
    request: LocalAiSetActionPromptOverrideRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    set_action_prompt_override(request.action_kind, request.prompt.as_deref())
}

#[tauri::command]
pub fn ai_install_external_agent(
    app: AppHandle,
    request: ExternalAiAgentInstallRequest,
) -> Result<ExternalAiAgentInstallResponse, String> {
    ensure_entitled()?;
    super::external_agents::install_external_agent(app, request)
}

#[tauri::command]
pub fn ai_remove_external_agent(request: ExternalAiAgentCommandRequest) -> Result<(), String> {
    ensure_entitled()?;
    super::external_agents::remove_external_agent(request)
}

#[tauri::command]
pub fn ai_authenticate_external_agent(
    request: ExternalAiAgentCommandRequest,
) -> Result<ExternalAiAgentStatus, String> {
    ensure_entitled()?;
    super::external_agents::authenticate_external_agent(request)
}

#[tauri::command]
pub fn ai_logout_external_agent(
    request: ExternalAiAgentCommandRequest,
) -> Result<ExternalAiAgentStatus, String> {
    ensure_entitled()?;
    super::external_agents::logout_external_agent(request)
}

#[tauri::command]
pub async fn ai_run_external_agent_prompt(
    app: AppHandle,
    request: ExternalAiPromptRequest,
) -> Result<ExternalAiPromptResponse, String> {
    ensure_entitled()?;
    super::acp_client::run_external_agent_prompt(app, request).await
}

#[tauri::command]
pub fn ai_cancel_external_agent_run(request: ExternalAiCancelRequest) -> Result<(), String> {
    ensure_entitled()?;
    super::acp_client::cancel_external_agent_run(&request.run_id)
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
    if request_prefers_configured_engine(request) {
        let stored_preferences = load_preferences();
        if let Some(agent_id) = selected_external_agent_id(request, &stored_preferences) {
            return run_external_agent_action(app, request, agent_id).await;
        }
    }

    let local_run = prepare_local_run_environment(request).await?;
    if request.action_kind == LocalAiActionKind::BranchReview {
        let LocalAiRunEnvironment {
            client,
            preferences,
            model_id,
            model,
            model_digest,
        } = local_run;
        return run_segmented_branch_review(
            app,
            request,
            client,
            model_id,
            &model,
            model_digest,
            &preferences,
        )
        .await;
    }

    run_local_model_action(app, request, local_run).await
}

fn request_prefers_configured_engine(request: &LocalAiRunRequest) -> bool {
    request
        .model_id
        .as_deref()
        .map_or(true, |model_id| model_id.trim().is_empty())
}

async fn prepare_local_run_environment(
    request: &LocalAiRunRequest,
) -> Result<LocalAiRunEnvironment, String> {
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
    ensure_model_supports_action(&model, request.action_kind)?;
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

    Ok(LocalAiRunEnvironment {
        client,
        preferences,
        model_id,
        model,
        model_digest,
    })
}

async fn run_local_model_action(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    local_run: LocalAiRunEnvironment,
) -> Result<LocalAiRunResult, String> {
    let effective_context =
        effective_context_window(request.action_kind, local_run.model.context_window);
    let git_context = build_local_action_context(app, request, effective_context)?;
    let prompt_instruction =
        effective_prompt_instruction(&local_run.preferences, request.action_kind);
    let (cache_key, cached) = prepare_run_cache(
        app,
        request,
        RunCacheRequest {
            prompt_version: PROMPT_VERSION,
            model_digest: &local_run.model_digest,
            prompt_instruction: prompt_instruction.as_ref(),
            input_digest: &git_context.input_digest,
            force_refresh_message: "Bypassing cached analysis",
            cached_lookup_message: "Checking cache",
            cache_hit_message: "Using cached analysis",
        },
    );
    if let Some(cached) = cached {
        return Ok(cached);
    }

    let prompt = build_prompt_with_instruction(&git_context, &prompt_instruction);
    let generation_context = generation_context_window_for_prompt(
        request.action_kind,
        local_run.model.context_window,
        prompt.len(),
    );
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::RunningModel,
        "Running local model",
        None,
    );
    let raw_response = local_run
        .client
        .generate_json(
            &local_run.model_id,
            &prompt,
            request.action_kind,
            generation_context,
            &keep_alive_duration(&local_run.preferences),
        )
        .await?;
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::FormattingResult,
        formatting_message(request.action_kind),
        None,
    );
    let structured = parse_structured_result(request.action_kind, &raw_response)?;
    let result = LocalAiRunResult {
        action_kind: request.action_kind,
        model_id: local_run.model_id,
        model_digest: local_run.model_digest,
        prompt_version: PROMPT_VERSION.to_string(),
        input_digest: git_context.input_digest,
        from_cache: false,
        metadata: git_context.metadata,
        result: structured,
    };

    complete_run(app, request, Some(cache_key), result)
}

async fn run_external_agent_action(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    agent_id: &str,
) -> Result<LocalAiRunResult, String> {
    let status = super::external_agents::external_agent_status(agent_id)?;
    if !status.available {
        return Err(status.error.unwrap_or_else(|| {
            format!(
                "EXTERNAL_AI_AGENT_SETUP_REQUIRED: {} is not available.",
                agent_id
            )
        }));
    }

    let git_context = build_external_agent_context(app, request)?;
    let preferences = load_preferences();
    let external_agent_option_values = external_agent_effective_option_values(
        &preferences,
        agent_id,
        request.action_kind,
        &request.external_agent_option_overrides,
    );
    let agent_digest = external_agent_digest(
        agent_id,
        status.version.as_deref(),
        &external_agent_option_values,
    );
    let prompt_instruction = effective_prompt_instruction(&preferences, request.action_kind);
    let (cache_key, cached) = prepare_run_cache(
        app,
        request,
        RunCacheRequest {
            prompt_version: EXTERNAL_AGENT_PROMPT_VERSION,
            model_digest: &agent_digest,
            prompt_instruction: prompt_instruction.as_ref(),
            input_digest: &git_context.input_digest,
            force_refresh_message: "Bypassing cached external analysis",
            cached_lookup_message: "Checking external agent cache",
            cache_hit_message: "Using cached external analysis",
        },
    );
    if let Some(cached) = cached {
        return Ok(cached);
    }

    let run_id = request
        .run_id
        .clone()
        .unwrap_or_else(|| operation_id(agent_id));
    let prompt = build_external_agent_prompt_with_instruction(&git_context, &prompt_instruction);
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::RunningModel,
        "Running external agent",
        None,
    );
    let response = super::acp_client::run_external_agent_prompt(
        app.clone(),
        ExternalAiPromptRequest {
            agent_id: agent_id.to_string(),
            repo_path: request.repo_path.clone(),
            run_id,
            action_kind: request.action_kind,
            prompt,
            external_agent_option_overrides: external_agent_option_values,
        },
    )
    .await?;

    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::FormattingResult,
        formatting_message(request.action_kind),
        None,
    );
    let structured = parse_structured_result(request.action_kind, &response.transcript)
        .unwrap_or_else(|error| {
            external_unstructured_result(request.action_kind, &response.transcript, &error)
        });
    let result = LocalAiRunResult {
        action_kind: request.action_kind,
        model_id: format!("external:{}", agent_id),
        model_digest: agent_digest,
        prompt_version: EXTERNAL_AGENT_PROMPT_VERSION.to_string(),
        input_digest: git_context.input_digest,
        from_cache: false,
        metadata: git_context.metadata,
        result: structured,
    };

    complete_run(app, request, Some(cache_key), result)
}

async fn run_segmented_branch_review(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    client: OllamaClient,
    model_id: String,
    model: &LocalAiModelEntry,
    model_digest: String,
    preferences: &LocalAiPreferences,
) -> Result<LocalAiRunResult, String> {
    let base_ref = request
        .base_ref
        .as_deref()
        .ok_or_else(|| "Base ref is required for branch AI.".to_string())?;
    let head_ref = request
        .head_ref
        .as_deref()
        .ok_or_else(|| "Head ref is required for branch AI.".to_string())?;
    let effective_context = effective_context_window(request.action_kind, model.context_window);
    let file_contexts = build_branch_review_file_contexts(
        &request.repo_path,
        base_ref,
        head_ref,
        request.comparison_mode.as_deref().unwrap_or("direct"),
        effective_context,
        |step| emit_branch_context_progress(app, request, step),
    )?;
    let prompt_instruction =
        effective_prompt_instruction(preferences, LocalAiActionKind::BranchReview).into_owned();
    let (cache_key, cached) = prepare_run_cache(
        app,
        request,
        RunCacheRequest {
            prompt_version: PROMPT_VERSION,
            model_digest: &model_digest,
            prompt_instruction: prompt_instruction.as_str(),
            input_digest: &file_contexts.input_digest,
            force_refresh_message: "Bypassing cached review",
            cached_lookup_message: "Checking cache",
            cache_hit_message: "Using cached review",
        },
    );
    if let Some(cached) = cached {
        return Ok(cached);
    }

    let input_digest = file_contexts.input_digest;
    let metadata = file_contexts.metadata;
    let blocks = file_contexts.blocks;
    let total_blocks = blocks.len();
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::RunningModel,
        &format!(
            "Running local model on {} file block{}",
            total_blocks,
            if total_blocks == 1 { "" } else { "s" }
        ),
        None,
    );

    let keep_alive = keep_alive_duration(preferences);
    let block_results = stream::iter(blocks.into_iter().map(|context| {
        let client = client.clone();
        let model_id = model_id.clone();
        let keep_alive = keep_alive.clone();
        let prompt_instruction = prompt_instruction.clone();
        let model_context_window = model.context_window;

        async move {
            let file_path = context.title.clone();
            let prompt = build_prompt_with_instruction(&context, &prompt_instruction);
            let generation_context = generation_context_window_for_prompt(
                LocalAiActionKind::BranchReview,
                model_context_window,
                prompt.len(),
            );
            let raw_response = client
                .generate_json(
                    &model_id,
                    &prompt,
                    LocalAiActionKind::BranchReview,
                    generation_context,
                    &keep_alive,
                )
                .await
                .map_err(|error| format!("{}: {}", file_path, error))?;
            let structured =
                parse_structured_result(LocalAiActionKind::BranchReview, &raw_response)
                    .map_err(|error| format!("{}: {}", file_path, error))?;
            match structured {
                LocalAiStructuredResult::BranchReview(review) => Ok((file_path, review)),
                _ => Err("Local AI returned the wrong branch review result type.".to_string()),
            }
        }
    }))
    .buffer_unordered(BRANCH_REVIEW_PARALLEL_CALLS)
    .collect::<Vec<Result<(String, LocalAiBranchReviewResult), String>>>()
    .await;

    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::FormattingResult,
        formatting_message(request.action_kind),
        None,
    );

    let mut reviews = Vec::new();
    let mut failures = Vec::new();
    for result in block_results {
        match result {
            Ok(review) => reviews.push(review),
            Err(error) => failures.push(error),
        }
    }

    if reviews.is_empty() {
        return Err(format!(
            "Local AI branch review failed for all {} file block{}: {}",
            total_blocks,
            if total_blocks == 1 { "" } else { "s" },
            failures.join("; ")
        ));
    }

    let had_failures = !failures.is_empty();
    let structured = LocalAiStructuredResult::BranchReview(merge_branch_review_blocks(
        reviews,
        failures,
        total_blocks,
    ));
    let result = LocalAiRunResult {
        action_kind: request.action_kind,
        model_id,
        model_digest,
        prompt_version: PROMPT_VERSION.to_string(),
        input_digest,
        from_cache: false,
        metadata,
        result: structured,
    };

    complete_run(app, request, (!had_failures).then_some(cache_key), result)
}
