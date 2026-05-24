use super::super::git_context::{
    build_branch_context, build_commit_analysis_context, build_external_agent_branch_context,
    build_external_agent_commit_analysis_context, build_external_agent_git_context,
    build_git_context, LocalAiGitContext,
};
use super::super::types::{LocalAiActionKind, LocalAiRunRequest};
use super::progress::{emit_branch_context_progress, emit_commit_context_progress};
use tauri::AppHandle;

pub(super) fn build_local_action_context(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    effective_context: usize,
) -> Result<LocalAiGitContext, String> {
    match request.action_kind {
        LocalAiActionKind::CommitAnalysis => {
            let sha = request
                .commit_sha
                .as_deref()
                .ok_or_else(|| "Commit SHA is required for commit analysis.".to_string())?;
            build_commit_analysis_context(&request.repo_path, sha, effective_context, |step| {
                emit_commit_context_progress(app, request, step);
            })
        }
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            let base_ref = request
                .base_ref
                .as_deref()
                .ok_or_else(|| "Base ref is required for branch AI.".to_string())?;
            let head_ref = request
                .head_ref
                .as_deref()
                .ok_or_else(|| "Head ref is required for branch AI.".to_string())?;
            build_branch_context(
                &request.repo_path,
                base_ref,
                head_ref,
                request.comparison_mode.as_deref().unwrap_or("direct"),
                request.action_kind,
                effective_context,
                |step| emit_branch_context_progress(app, request, step),
            )
        }
        _ => build_git_context(request, effective_context),
    }
}

pub(super) fn build_external_agent_context(
    app: &AppHandle,
    request: &LocalAiRunRequest,
) -> Result<LocalAiGitContext, String> {
    match request.action_kind {
        LocalAiActionKind::CommitAnalysis => {
            let sha = request
                .commit_sha
                .as_deref()
                .ok_or_else(|| "Commit SHA is required for commit analysis.".to_string())?;
            build_external_agent_commit_analysis_context(&request.repo_path, sha, |step| {
                emit_commit_context_progress(app, request, step);
            })
        }
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            let base_ref = request
                .base_ref
                .as_deref()
                .ok_or_else(|| "Base ref is required for branch AI.".to_string())?;
            let head_ref = request
                .head_ref
                .as_deref()
                .ok_or_else(|| "Head ref is required for branch AI.".to_string())?;
            build_external_agent_branch_context(
                &request.repo_path,
                base_ref,
                head_ref,
                request.comparison_mode.as_deref().unwrap_or("direct"),
                request.action_kind,
                |step| emit_branch_context_progress(app, request, step),
            )
        }
        _ => build_external_agent_git_context(request),
    }
}
