use super::super::context_window::{
    effective_context_window, generation_context_window_for_prompt,
};
use super::super::entitlement::ensure_entitled;
use super::super::git_context::{build_branch_review_file_contexts, LocalAiGitContext};
use super::super::models::{
    external_agent_effective_option_values, load_preferences,
    reconcile_preferences_with_available_models, resolve_model_id, NO_AI_MODELS_AVAILABLE_MESSAGE,
};
use super::super::ollama::OllamaClient;
use super::super::prompts::{
    build_external_agent_prompt_with_instruction, build_prompt_with_instruction,
    effective_prompt_instruction, parse_structured_result, EXTERNAL_AGENT_PROMPT_VERSION,
    PROMPT_VERSION,
};
use super::super::runtime::start_managed_runtime_if_installed;
use super::super::types::{
    ExternalAiPromptRequest, LocalAiActionKind, LocalAiBranchReviewResult, LocalAiModelEntry,
    LocalAiPreferences, LocalAiRunMetadata, LocalAiRunProgressState, LocalAiRunRequest,
    LocalAiRunResult, LocalAiStructuredResult,
};
use super::action_context::{build_external_agent_context, build_local_action_context};
use super::branch_review::{merge_branch_review_blocks, BRANCH_REVIEW_PARALLEL_CALLS};
use super::external_agent::{
    external_agent_digest, external_unstructured_result, selected_external_agent_id,
};
use super::model_helpers::{
    ensure_model_supports_action, ensure_supported_model, keep_alive_duration, operation_id,
};
use super::progress::{emit_branch_context_progress, emit_run_progress, formatting_message};
use super::run_cache::{complete_run, prepare_run_cache, RunCacheRequest};
use futures_util::{stream, StreamExt};
use tauri::AppHandle;

struct LocalAiRunEnvironment {
    client: OllamaClient,
    preferences: LocalAiPreferences,
    model_id: String,
    model: LocalAiModelEntry,
    model_digest: String,
}

struct AiRunPipeline {
    prompt_version: &'static str,
    model_id: String,
    model_digest: String,
    input_digest: String,
    metadata: LocalAiRunMetadata,
}

struct AiRunCacheMessages {
    force_refresh: &'static str,
    lookup: &'static str,
    hit: &'static str,
}

impl AiRunPipeline {
    fn from_context(
        prompt_version: &'static str,
        model_id: String,
        model_digest: String,
        context: LocalAiGitContext,
    ) -> Self {
        Self {
            prompt_version,
            model_id,
            model_digest,
            input_digest: context.input_digest,
            metadata: context.metadata,
        }
    }

    fn into_result(
        self,
        action_kind: LocalAiActionKind,
        result: LocalAiStructuredResult,
    ) -> LocalAiRunResult {
        LocalAiRunResult {
            action_kind,
            model_id: self.model_id,
            model_digest: self.model_digest,
            prompt_version: self.prompt_version.to_string(),
            input_digest: self.input_digest,
            from_cache: false,
            metadata: self.metadata,
            result,
        }
    }
}

fn prepare_action_run_cache(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    prompt_version: &'static str,
    model_digest: &str,
    prompt_instruction: &str,
    input_digest: &str,
    messages: AiRunCacheMessages,
) -> (String, Option<LocalAiRunResult>) {
    prepare_run_cache(
        app,
        request,
        RunCacheRequest {
            prompt_version,
            model_digest,
            prompt_instruction,
            input_digest,
            force_refresh_message: messages.force_refresh,
            cached_lookup_message: messages.lookup,
            cache_hit_message: messages.hit,
        },
    )
}

fn finish_action_run(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    cache_key: String,
    pipeline: AiRunPipeline,
    structured: LocalAiStructuredResult,
) -> Result<LocalAiRunResult, String> {
    complete_run(
        app,
        request,
        Some(cache_key),
        pipeline.into_result(request.action_kind, structured),
    )
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
    let (cache_key, cached) = prepare_action_run_cache(
        app,
        request,
        PROMPT_VERSION,
        &local_run.model_digest,
        prompt_instruction.as_ref(),
        &git_context.input_digest,
        AiRunCacheMessages {
            force_refresh: "Bypassing cached analysis",
            lookup: "Checking cache",
            hit: "Using cached analysis",
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
    let pipeline = AiRunPipeline::from_context(
        PROMPT_VERSION,
        local_run.model_id,
        local_run.model_digest,
        git_context,
    );

    finish_action_run(app, request, cache_key, pipeline, structured)
}

async fn run_external_agent_action(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    agent_id: &str,
) -> Result<LocalAiRunResult, String> {
    let status = super::super::external_agents::external_agent_status(agent_id)?;
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
    let (cache_key, cached) = prepare_action_run_cache(
        app,
        request,
        EXTERNAL_AGENT_PROMPT_VERSION,
        &agent_digest,
        prompt_instruction.as_ref(),
        &git_context.input_digest,
        AiRunCacheMessages {
            force_refresh: "Bypassing cached external analysis",
            lookup: "Checking external agent cache",
            hit: "Using cached external analysis",
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
    let response = super::super::acp_client::run_external_agent_prompt(
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
    let pipeline = AiRunPipeline::from_context(
        EXTERNAL_AGENT_PROMPT_VERSION,
        format!("external:{}", agent_id),
        agent_digest,
        git_context,
    );

    finish_action_run(app, request, cache_key, pipeline, structured)
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
