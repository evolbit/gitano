use super::super::git_context::{LocalAiBranchContextStep, LocalAiCommitAnalysisContextStep};
use super::super::types::{
    LocalAiActionKind, LocalAiRunProgress, LocalAiRunProgressState, LocalAiRunRequest,
    LOCAL_AI_RUN_PROGRESS_EVENT,
};
use tauri::{AppHandle, Emitter};

pub(super) fn emit_commit_context_progress(
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

pub(super) fn emit_branch_context_progress(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    step: LocalAiBranchContextStep,
) {
    match step {
        LocalAiBranchContextStep::ResolvingRefs => emit_run_progress(
            app,
            request,
            LocalAiRunProgressState::ResolvingRefs,
            "Resolving comparison refs",
            None,
        ),
        LocalAiBranchContextStep::DeterminingDiffBase => emit_run_progress(
            app,
            request,
            LocalAiRunProgressState::DeterminingDiffBase,
            "Determining diff base",
            None,
        ),
        LocalAiBranchContextStep::ReadingComparisonDiff => emit_run_progress(
            app,
            request,
            LocalAiRunProgressState::ReadingComparisonDiff,
            "Reading comparison diff",
            None,
        ),
    }
}

pub(super) fn emit_run_progress(
    app: &AppHandle,
    request: &LocalAiRunRequest,
    state: LocalAiRunProgressState,
    message: &str,
    error: Option<String>,
) {
    if !supports_run_progress(request.action_kind) {
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

fn supports_run_progress(action_kind: LocalAiActionKind) -> bool {
    matches!(
        action_kind,
        LocalAiActionKind::CommitAnalysis
            | LocalAiActionKind::BranchAnalysis
            | LocalAiActionKind::BranchReview
    )
}

pub(super) fn formatting_message(action_kind: LocalAiActionKind) -> &'static str {
    match action_kind {
        LocalAiActionKind::BranchReview => "Formatting review",
        _ => "Formatting analysis",
    }
}

pub(super) fn completed_message(action_kind: LocalAiActionKind) -> &'static str {
    match action_kind {
        LocalAiActionKind::BranchReview => "Review complete",
        _ => "Analysis complete",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn branch_review_uses_review_specific_progress_messages() {
        assert_eq!(
            formatting_message(LocalAiActionKind::BranchReview),
            "Formatting review"
        );
        assert_eq!(
            completed_message(LocalAiActionKind::BranchReview),
            "Review complete"
        );
    }

    #[test]
    fn only_analysis_actions_emit_run_progress() {
        assert!(supports_run_progress(LocalAiActionKind::CommitAnalysis));
        assert!(supports_run_progress(LocalAiActionKind::BranchAnalysis));
        assert!(supports_run_progress(LocalAiActionKind::BranchReview));
        assert!(!supports_run_progress(LocalAiActionKind::CommitMessage));
        assert!(!supports_run_progress(
            LocalAiActionKind::MergeConflictSuggestions
        ));
    }
}
