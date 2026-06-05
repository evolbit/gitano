use super::context_window::prompt_context_budget_chars;
use super::types::{
    LocalAiActionKind, LocalAiConflictCandidateInput, LocalAiRunMetadata, LocalAiRunRequest,
};
use sha2::{Digest, Sha256};
use std::process::Command;

mod branch;
mod branch_refs;
mod branch_review_files;
mod commit;
mod conflicts;
mod review_order;
mod staged;
use branch::{
    branch_context, branch_context_with_progress, branch_context_with_progress_and_order,
    branch_external_agent_context_with_progress,
};
use branch_review_files::build_branch_review_file_contexts_with_progress;
use commit::{
    commit_context, commit_context_with_progress, commit_external_agent_context,
    commit_external_agent_context_with_progress,
};
use conflicts::{conflict_context, conflict_external_agent_context};
use staged::{staged_context, staged_external_agent_context};

const DIFF_CONTEXT_LINES: usize = 3;
const COMMIT_MESSAGE_DIFF_CONTEXT_LINES: usize = 1;

#[derive(Debug, Clone)]
pub struct LocalAiGitContext {
    pub action_kind: LocalAiActionKind,
    pub title: String,
    pub prompt_context: String,
    pub input_digest: String,
    pub metadata: LocalAiRunMetadata,
    pub conflict_candidate_input: Option<LocalAiConflictCandidateInput>,
}

#[derive(Debug, Clone)]
pub struct LocalAiBranchReviewFileContexts {
    pub input_digest: String,
    pub metadata: LocalAiRunMetadata,
    pub blocks: Vec<LocalAiGitContext>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalAiCommitAnalysisContextStep {
    ResolvingCommit,
    ReadingCommitDiff,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalAiBranchContextStep {
    ResolvingRefs,
    DeterminingDiffBase,
    ReadingComparisonDiff,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BranchDiffOrder {
    Git,
    ReviewPriority,
}

pub fn build_git_context(
    request: &LocalAiRunRequest,
    context_window: usize,
) -> Result<LocalAiGitContext, String> {
    let raw = match request.action_kind {
        LocalAiActionKind::CommitMessage => staged_context(&request.repo_path)?,
        LocalAiActionKind::CommitAnalysis => {
            let sha = request
                .commit_sha
                .as_deref()
                .ok_or_else(|| "Commit SHA is required for commit analysis.".to_string())?;
            commit_context(&request.repo_path, sha)?
        }
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            let base_ref = request
                .base_ref
                .as_deref()
                .ok_or_else(|| "Base ref is required for branch analysis.".to_string())?;
            let head_ref = request
                .head_ref
                .as_deref()
                .ok_or_else(|| "Head ref is required for branch analysis.".to_string())?;
            branch_context(
                &request.repo_path,
                base_ref,
                head_ref,
                request.comparison_mode.as_deref().unwrap_or("direct"),
                request.action_kind,
            )?
        }
        LocalAiActionKind::MergeConflictSuggestions => {
            conflict_context(&request.repo_path, request.conflict_scope.as_ref())?
        }
    };

    Ok(apply_context_budget(
        raw,
        prompt_context_budget_chars(request.action_kind, context_window),
    ))
}

pub fn build_external_agent_git_context(
    request: &LocalAiRunRequest,
) -> Result<LocalAiGitContext, String> {
    match request.action_kind {
        LocalAiActionKind::CommitMessage => staged_external_agent_context(&request.repo_path),
        LocalAiActionKind::CommitAnalysis => {
            let sha = request
                .commit_sha
                .as_deref()
                .ok_or_else(|| "Commit SHA is required for commit analysis.".to_string())?;
            commit_external_agent_context(&request.repo_path, sha)
        }
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            let base_ref = request
                .base_ref
                .as_deref()
                .ok_or_else(|| "Base ref is required for branch analysis.".to_string())?;
            let head_ref = request
                .head_ref
                .as_deref()
                .ok_or_else(|| "Head ref is required for branch analysis.".to_string())?;
            branch_context_with_progress_and_order(
                &request.repo_path,
                base_ref,
                head_ref,
                request.comparison_mode.as_deref().unwrap_or("direct"),
                request.action_kind,
                if request.action_kind == LocalAiActionKind::BranchReview {
                    BranchDiffOrder::ReviewPriority
                } else {
                    BranchDiffOrder::Git
                },
                |_| {},
            )
        }
        LocalAiActionKind::MergeConflictSuggestions => {
            conflict_external_agent_context(&request.repo_path, request.conflict_scope.as_ref())
        }
    }
}

pub fn build_commit_analysis_context<F>(
    repo_path: &str,
    sha: &str,
    context_window: usize,
    on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiCommitAnalysisContextStep),
{
    Ok(apply_context_budget(
        commit_context_with_progress(repo_path, sha, on_step)?,
        prompt_context_budget_chars(LocalAiActionKind::CommitAnalysis, context_window),
    ))
}

pub fn build_external_agent_commit_analysis_context<F>(
    repo_path: &str,
    sha: &str,
    on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiCommitAnalysisContextStep),
{
    commit_external_agent_context_with_progress(repo_path, sha, on_step)
}

pub fn build_branch_context<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    action_kind: LocalAiActionKind,
    context_window: usize,
    on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiBranchContextStep),
{
    Ok(apply_context_budget(
        branch_context_with_progress(
            repo_path,
            base_ref,
            head_ref,
            comparison_mode,
            action_kind,
            on_step,
        )?,
        prompt_context_budget_chars(action_kind, context_window),
    ))
}

pub fn build_external_agent_branch_context<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    action_kind: LocalAiActionKind,
    on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiBranchContextStep),
{
    branch_external_agent_context_with_progress(
        repo_path,
        base_ref,
        head_ref,
        comparison_mode,
        action_kind,
        on_step,
    )
}

pub fn build_branch_review_file_contexts<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    context_window: usize,
    on_step: F,
) -> Result<LocalAiBranchReviewFileContexts, String>
where
    F: FnMut(LocalAiBranchContextStep),
{
    build_branch_review_file_contexts_with_progress(
        repo_path,
        base_ref,
        head_ref,
        comparison_mode,
        context_window,
        on_step,
    )
}

fn apply_context_budget(context: LocalAiGitContext, max_chars: usize) -> LocalAiGitContext {
    let mut context = context;
    if context.prompt_context.len() <= max_chars {
        return context;
    }

    context
        .metadata
        .omitted_sections
        .push("Prompt context was truncated to fit the selected model budget.".to_string());
    context.prompt_context.truncate(max_chars);
    context.prompt_context.push_str(
        "\n\n[Context truncated by Gitano to fit the selected local model context window.]",
    );
    context.input_digest = digest_parts(&[
        context.action_kind.as_key(),
        &context.title,
        &context.prompt_context,
    ]);
    context
}

fn empty_metadata() -> LocalAiRunMetadata {
    LocalAiRunMetadata {
        omitted_files: vec![],
        omitted_sections: vec![],
    }
}

pub fn digest_parts(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update([0]);
    }
    format!("{:x}", hasher.finalize())
}

fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    Err(format!(
        "git {:?} failed: {}",
        args,
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::context_window::prompt_context_budget_chars;

    #[test]
    fn applies_context_budget_with_metadata() {
        let context = LocalAiGitContext {
            action_kind: LocalAiActionKind::CommitAnalysis,
            title: "test".to_string(),
            prompt_context: "a".repeat(20_000),
            input_digest: "input".to_string(),
            metadata: empty_metadata(),
            conflict_candidate_input: None,
        };

        let budgeted = apply_context_budget(context, 3_000);

        assert!(budgeted.prompt_context.len() < 20_000);
        assert!(!budgeted.metadata.omitted_sections.is_empty());
    }

    #[test]
    fn commit_message_context_uses_smaller_budget() {
        let budget = prompt_context_budget_chars(LocalAiActionKind::CommitMessage, 32_768);

        assert_eq!(budget, 18_000);
    }

    #[test]
    fn branch_review_context_reserves_prediction_budget_for_phi_context() {
        let budget = prompt_context_budget_chars(LocalAiActionKind::BranchReview, 131_072);

        assert_eq!(budget, (65_536 - 4_096) * 3);
    }
}
