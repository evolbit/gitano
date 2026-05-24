use super::super::cache::{build_cache_key, get_cached_result, put_cached_result};
use super::super::types::{LocalAiRunProgressState, LocalAiRunRequest, LocalAiRunResult};
use super::progress::{completed_message, emit_run_progress};
use tauri::AppHandle;

pub(super) struct RunCacheRequest<'a> {
    pub(super) prompt_version: &'a str,
    pub(super) model_digest: &'a str,
    pub(super) prompt_instruction: &'a str,
    pub(super) input_digest: &'a str,
    pub(super) force_refresh_message: &'a str,
    pub(super) cached_lookup_message: &'a str,
    pub(super) cache_hit_message: &'a str,
}

pub(super) fn prepare_run_cache(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    cache: RunCacheRequest<'_>,
) -> (String, Option<LocalAiRunResult>) {
    emit_cache_check_progress(
        app,
        request,
        cache.force_refresh_message,
        cache.cached_lookup_message,
    );
    let cache_key = build_cache_key(
        request.action_kind,
        cache.prompt_version,
        cache.model_digest,
        cache.prompt_instruction,
        &request.repo_path,
        cache.input_digest,
    );
    let cached = cached_run_result(app, request, &cache_key, cache.cache_hit_message);
    (cache_key, cached)
}

pub(super) fn complete_run(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    cache_key: Option<String>,
    result: LocalAiRunResult,
) -> Result<LocalAiRunResult, String> {
    if let Some(cache_key) = cache_key {
        put_cached_result(cache_key, &result)?;
    }
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::Completed,
        completed_message(request.action_kind),
        None,
    );
    Ok(result)
}

fn emit_cache_check_progress(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    force_refresh_message: &str,
    cached_lookup_message: &str,
) {
    let message = if request.force_refresh {
        force_refresh_message
    } else {
        cached_lookup_message
    };

    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::CheckingCache,
        message,
        None,
    );
}

fn cached_run_result(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    cache_key: &str,
    cache_hit_message: &str,
) -> Option<LocalAiRunResult> {
    if request.force_refresh {
        return None;
    }

    let cached = get_cached_result(cache_key)?;
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::CacheHit,
        cache_hit_message,
        None,
    );
    emit_run_progress(
        app,
        request,
        LocalAiRunProgressState::Completed,
        completed_message(request.action_kind),
        None,
    );
    Some(cached)
}
