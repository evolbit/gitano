use super::super::git_context::LocalAiGitContext;
use super::super::types::{LocalAiActionKind, LocalAiPreferences};
use std::borrow::Cow;

pub fn default_prompt_instruction(action_kind: LocalAiActionKind) -> &'static str {
    match action_kind {
        LocalAiActionKind::CommitMessage => {
            "Generate a Git commit message for the staged changes only.\n\
             Requirements:\n\
             - The message must be specific to the files and behavior changed.\n\
             - Use imperative mood and keep the subject near 72 characters.\n\
             - Prefer conventional commit style when a clear type fits: feat, fix, refactor, test, docs, chore.\n\
             - Do not use generic messages like \"Update changes\", \"Update files\", \"Misc changes\", or \"Refactor code\"."
        }
        LocalAiActionKind::CommitAnalysis => {
            "Analyze this commit for correctness, risk, and maintainability."
        }
        LocalAiActionKind::BranchAnalysis => {
            "Analyze this branch or PR-style diff as a reviewer preparing to approve or question a PR.\n\
             Focus on intent, real risks, behavioral changes, potential regressions, test gaps, recommendations, and action items.\n\
             Do not return a raw changed-file list; the UI already shows the changed files. Mention files only when they support a concrete risk or action item.\n\
             Do not create low-value findings. If there are no concrete findings, return an empty findings array and useful recommendations or action items if applicable.\n\
             Keep the report focused on findings that affect review or release decisions."
        }
        LocalAiActionKind::BranchReview => {
            "Review this branch like PR review feedback. Find changed lines that may introduce bugs, regressions, unsafe assumptions, missing validation, missing tests, or maintainability issues.\n\
             Every inline finding must be anchored to a changed line from the diff. Use side \"new\" for added/modified new-code feedback and side \"old\" only when the deleted line itself needs attention.\n\
             Do not summarize files. Do not produce informational cleanup comments. If there are no actionable changed-code risks, return an empty findings array and a concise summary.\n\
             Suggested comments should be ready to paste into a PR and should ask for a concrete change or clarification.\n\
             Include all material changed-code risks you can substantiate.\n\
             Prioritize actionable, high-confidence findings over exhaustive or stylistic feedback."
        }
        LocalAiActionKind::MergeConflictSuggestions => {
            "Suggest how to resolve these merge conflicts without modifying files."
        }
    }
}

pub fn effective_prompt_instruction(
    preferences: &LocalAiPreferences,
    action_kind: LocalAiActionKind,
) -> Cow<'_, str> {
    preferences
        .action_prompt_overrides
        .get(action_kind.as_key())
        .map(String::as_str)
        .map(str::trim)
        .filter(|prompt| !prompt.is_empty())
        .map(Cow::Borrowed)
        .unwrap_or_else(|| Cow::Borrowed(default_prompt_instruction(action_kind)))
}

pub fn build_prompt_with_instruction(context: &LocalAiGitContext, instruction: &str) -> String {
    match context.action_kind {
        LocalAiActionKind::CommitMessage => build_commit_message_prompt(context, instruction),
        LocalAiActionKind::CommitAnalysis => build_analysis_prompt(instruction, context),
        LocalAiActionKind::BranchAnalysis => build_branch_analysis_prompt(context, instruction),
        LocalAiActionKind::BranchReview => build_branch_review_prompt(context, instruction),
        LocalAiActionKind::MergeConflictSuggestions => build_conflict_prompt(context, instruction),
    }
}

pub fn build_external_agent_prompt_with_instruction(
    context: &LocalAiGitContext,
    instruction: &str,
) -> String {
    let output_shape = match context.action_kind {
        LocalAiActionKind::CommitMessage => "{\"message\":\"...\",\"alternatives\":[\"...\"]}",
        LocalAiActionKind::CommitAnalysis => {
            "{\"summary\":\"...\",\"riskAssessment\":\"...\",\"changedAreas\":[\"...\"],\"findings\":[{\"severity\":\"info|low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"filePath\":\"optional\",\"line\":123,\"suggestion\":\"optional\"}]}"
        }
        LocalAiActionKind::BranchAnalysis => {
            "{\"summary\":\"...\",\"riskAssessment\":\"...\",\"behavioralChanges\":[\"...\"],\"potentialRegressions\":[\"...\"],\"testGaps\":[\"...\"],\"recommendations\":[\"...\"],\"actionItems\":[\"...\"],\"findings\":[{\"severity\":\"info|low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"filePath\":\"optional\",\"line\":123,\"suggestion\":\"optional\"}]}"
        }
        LocalAiActionKind::BranchReview => {
            "{\"summary\":\"...\",\"findings\":[{\"severity\":\"low|medium|high\",\"confidence\":\"low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"impact\":\"...\",\"recommendation\":\"...\",\"suggestedComment\":\"...\",\"filePath\":\"path/to/file\",\"side\":\"old|new\",\"line\":123,\"endLine\":124}],\"notes\":[{\"severity\":\"low|medium|high\",\"confidence\":\"low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"recommendation\":\"...\",\"suggestedComment\":\"optional\",\"filePath\":\"optional\"}]}"
        }
        LocalAiActionKind::MergeConflictSuggestions => {
            "{\"summary\":\"...\",\"files\":[{\"filePath\":\"...\",\"summary\":\"...\",\"suggestion\":\"...\"}]}"
        }
    };

    format!(
        "You are Gitano's selected external ACP coding agent. The user explicitly selected this agent for repository analysis.\n\
         Use the Git descriptor below to identify the exact repository scope, then inspect the code yourself with read-only repository commands such as git diff, git status, git show, git log, git ls-files, git rev-parse, and git merge-base. Do not modify files, run write/destructive commands, or submit remote feedback.\n\
         Be specific, evidence-oriented, and concise. Do not claim certainty without file or line evidence.\n\
         {}\n\n\
         Return only JSON with this shape: {}\n\n\
         Git descriptor:\n{}",
        instruction, output_shape, context.prompt_context
    )
}

fn build_commit_message_prompt(context: &LocalAiGitContext, instruction: &str) -> String {
    format!(
         "You are Gitano's local coding assistant.\n\
         {}\n\
         Return only compact JSON with this shape: {{\"message\":\"...\",\"alternatives\":[\"...\"]}}\n\
         Staged Git context:\n{}",
        instruction, context.prompt_context
    )
}

fn build_analysis_prompt(instruction: &str, context: &LocalAiGitContext) -> String {
    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         Be specific, evidence-oriented, and concise. Do not claim certainty without file or line evidence.\n\
         {}\n\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"riskAssessment\":\"...\",\"changedAreas\":[\"...\"],\"findings\":[{{\"severity\":\"info|low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"filePath\":\"optional\",\"line\":123,\"suggestion\":\"optional\"}}]}}\n\n\
         Git context:\n{}",
        instruction, context.prompt_context
    )
}

fn build_branch_analysis_prompt(context: &LocalAiGitContext, instruction: &str) -> String {
    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         {}\n\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"riskAssessment\":\"...\",\"behavioralChanges\":[\"...\"],\"potentialRegressions\":[\"...\"],\"testGaps\":[\"...\"],\"recommendations\":[\"...\"],\"actionItems\":[\"...\"],\"findings\":[{{\"severity\":\"info|low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"filePath\":\"optional\",\"line\":123,\"suggestion\":\"optional\"}}]}}\n\n\
         Git context:\n{}",
        instruction, context.prompt_context
    )
}

fn build_branch_review_prompt(context: &LocalAiGitContext, instruction: &str) -> String {
    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         {}\n\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"findings\":[{{\"severity\":\"low|medium|high\",\"confidence\":\"low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"impact\":\"...\",\"recommendation\":\"...\",\"suggestedComment\":\"...\",\"filePath\":\"path/to/file\",\"side\":\"old|new\",\"line\":123,\"endLine\":124}}],\"notes\":[{{\"severity\":\"low|medium|high\",\"confidence\":\"low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"recommendation\":\"...\",\"suggestedComment\":\"optional\",\"filePath\":\"optional\"}}]}}\n\n\
         Git context:\n{}",
        instruction, context.prompt_context
    )
}

fn build_conflict_prompt(context: &LocalAiGitContext, instruction: &str) -> String {
    format!(
        "You are Gitano's local coding assistant.\n\
         {}\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"files\":[{{\"filePath\":\"...\",\"summary\":\"...\",\"suggestion\":\"...\"}}]}}\n\
         Do not provide an auto-applied patch.\n\n\
         Git context:\n{}",
        instruction, context.prompt_context
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::types::LocalAiRunMetadata;

    fn test_context(action_kind: LocalAiActionKind) -> LocalAiGitContext {
        LocalAiGitContext {
            action_kind,
            title: "test".to_string(),
            prompt_context: "file.txt changed".to_string(),
            input_digest: "digest".to_string(),
            metadata: LocalAiRunMetadata {
                omitted_files: Vec::new(),
                omitted_sections: Vec::new(),
            },
        }
    }

    #[test]
    fn custom_local_prompt_keeps_output_shape_and_context() {
        let prompt = build_prompt_with_instruction(
            &test_context(LocalAiActionKind::BranchReview),
            "Focus only on authorization regressions.",
        );

        assert!(prompt.contains("Focus only on authorization regressions."));
        assert!(prompt.contains("Return only JSON with this shape"));
        assert!(prompt.contains("Git context:"));
        assert!(prompt.contains("file.txt changed"));
    }

    #[test]
    fn custom_external_prompt_keeps_read_only_constraints_and_shape() {
        let prompt = build_external_agent_prompt_with_instruction(
            &test_context(LocalAiActionKind::CommitMessage),
            "Use a short conventional commit subject.",
        );

        assert!(prompt.contains("Use a short conventional commit subject."));
        assert!(prompt.contains("Do not modify files"));
        assert!(prompt.contains("Return only JSON with this shape"));
        assert!(prompt.contains("Git descriptor:"));
    }
}
