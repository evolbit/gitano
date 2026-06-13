use super::super::git_context::LocalAiGitContext;
use super::super::types::{LocalAiActionKind, LocalAiConflictScope, LocalAiPreferences};
use std::borrow::Cow;

pub fn default_prompt_instruction(action_kind: LocalAiActionKind) -> &'static str {
    action_kind.default_prompt_instruction()
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

fn output_shape_for_action(action_kind: LocalAiActionKind) -> &'static str {
    match action_kind {
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
    }
}

fn output_shape_for_context(context: &LocalAiGitContext) -> &'static str {
    match &context.conflict_candidate_input {
        Some(input) => match &input.scope {
            LocalAiConflictScope::Region { .. } => {
                "{\"summary\":\"brief one-sentence resolution\",\"details\":\"full explanation of the resolution\",\"candidateKind\":\"regionReplacement\",\"replacement\":\"resolved content for the selected region\"}"
            }
            LocalAiConflictScope::File { .. } => {
                "{\"summary\":\"brief one-sentence file resolution\",\"details\":\"full explanation with per-region reasoning\",\"candidateKind\":\"fullFileResult\",\"content\":\"full resolved file content\",\"decisions\":[{\"regionId\":\"conflict-1\",\"selectedChoice\":\"current|incoming|combination|custom\",\"reason\":\"why this region was resolved this way\"}]}"
            }
        },
        None => output_shape_for_action(context.action_kind),
    }
}

fn json_output_contract(output_shape: &str) -> String {
    format!(
        "Return only valid JSON with this shape: {output_shape}\n\
         Do not include markdown fences, headings, progress text, status text, explanations, or any text before or after the JSON object."
    )
}

pub fn build_external_agent_prompt_with_instruction(
    context: &LocalAiGitContext,
    instruction: &str,
) -> String {
    let output_contract = json_output_contract(output_shape_for_context(context));

    format!(
        "You are Gitano's selected external ACP coding agent. The user explicitly selected this agent for repository analysis.\n\
         Use the Git descriptor below to identify the exact repository scope, then inspect the code yourself with read-only repository commands such as git diff, git status, git show, git log, git ls-files, git rev-parse, and git merge-base. Do not modify files, run write/destructive commands, or submit remote feedback.\n\
         Be specific, evidence-oriented, and concise. Do not claim certainty without file or line evidence.\n\
         {}\n\n\
         {}\n\n\
         Git descriptor:\n{}",
        instruction, output_contract, context.prompt_context
    )
}

fn build_commit_message_prompt(context: &LocalAiGitContext, instruction: &str) -> String {
    let output_contract = json_output_contract(output_shape_for_context(context));

    format!(
        "You are Gitano's local coding assistant.\n\
         {}\n\
         {}\n\
         Staged Git context:\n{}",
        instruction, output_contract, context.prompt_context
    )
}

fn build_analysis_prompt(instruction: &str, context: &LocalAiGitContext) -> String {
    let output_contract = json_output_contract(output_shape_for_context(context));

    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         Be specific, evidence-oriented, and concise. Do not claim certainty without file or line evidence.\n\
         {}\n\n\
         {}\n\n\
         Git context:\n{}",
        instruction, output_contract, context.prompt_context
    )
}

fn build_branch_analysis_prompt(context: &LocalAiGitContext, instruction: &str) -> String {
    let output_contract = json_output_contract(output_shape_for_context(context));

    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         {}\n\n\
         {}\n\n\
         Git context:\n{}",
        instruction, output_contract, context.prompt_context
    )
}

fn build_branch_review_prompt(context: &LocalAiGitContext, instruction: &str) -> String {
    let output_contract = json_output_contract(output_shape_for_context(context));

    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         {}\n\n\
         {}\n\n\
         Git context:\n{}",
        instruction, output_contract, context.prompt_context
    )
}

fn build_conflict_prompt(context: &LocalAiGitContext, instruction: &str) -> String {
    let output_contract = json_output_contract(output_shape_for_context(context));
    let scoped_instruction = if context.conflict_candidate_input.is_some() {
        "Return exactly one reviewable candidate for the target scope. For file-scoped conflict fixes, include one decisions entry for each listed conflict region. Do not mark the file resolved and do not claim that files were changed."
    } else {
        "Do not provide an auto-applied patch."
    };

    format!(
        "You are Gitano's local coding assistant.\n\
         {}\n\
         {}\n\
         {}\n\n\
         Git context:\n{}",
        instruction, output_contract, scoped_instruction, context.prompt_context
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::types::{LocalAiConflictCandidateInput, LocalAiRunMetadata};
    use crate::git::conflicts::types::GitConflictSignatures;

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
            conflict_candidate_input: None,
        }
    }

    fn scoped_region_context() -> LocalAiGitContext {
        let mut context = test_context(LocalAiActionKind::MergeConflictSuggestions);
        context.conflict_candidate_input = Some(LocalAiConflictCandidateInput {
            scope: LocalAiConflictScope::Region {
                file_path: "src/conflict.ts".to_string(),
                region_id: "conflict-1".to_string(),
            },
            signatures: GitConflictSignatures {
                index_signature: "index".to_string(),
                result_signature: "result".to_string(),
            },
        });
        context
    }

    fn scoped_file_context() -> LocalAiGitContext {
        let mut context = test_context(LocalAiActionKind::MergeConflictSuggestions);
        context.conflict_candidate_input = Some(LocalAiConflictCandidateInput {
            scope: LocalAiConflictScope::File {
                file_path: "src/conflict.ts".to_string(),
            },
            signatures: GitConflictSignatures {
                index_signature: "index".to_string(),
                result_signature: "result".to_string(),
            },
        });
        context
    }

    #[test]
    fn custom_local_prompt_keeps_output_shape_and_context() {
        let prompt = build_prompt_with_instruction(
            &test_context(LocalAiActionKind::BranchReview),
            "Focus only on authorization regressions.",
        );

        assert!(prompt.contains("Focus only on authorization regressions."));
        assert!(prompt.contains("Return only valid JSON with this shape"));
        assert!(prompt.contains("Do not include markdown fences"));
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
        assert!(prompt.contains("progress text, status text"));
        assert!(prompt.contains("Return only valid JSON with this shape"));
        assert!(prompt.contains("Git descriptor:"));
    }

    #[test]
    fn all_action_prompts_append_json_output_contract() {
        let action_kinds = [
            LocalAiActionKind::CommitMessage,
            LocalAiActionKind::CommitAnalysis,
            LocalAiActionKind::BranchAnalysis,
            LocalAiActionKind::BranchReview,
            LocalAiActionKind::MergeConflictSuggestions,
        ];

        for action_kind in action_kinds {
            let local_prompt =
                build_prompt_with_instruction(&test_context(action_kind), "Custom instruction.");
            let external_prompt = build_external_agent_prompt_with_instruction(
                &test_context(action_kind),
                "Custom instruction.",
            );

            assert!(local_prompt.contains("Return only valid JSON with this shape"));
            assert!(local_prompt.contains("Do not include markdown fences"));
            assert!(external_prompt.contains("Return only valid JSON with this shape"));
            assert!(external_prompt.contains("Do not include markdown fences"));
        }
    }

    #[test]
    fn scoped_conflict_prompt_requests_single_candidate_shape() {
        let prompt =
            build_prompt_with_instruction(&scoped_region_context(), "Fix the selected conflict.");

        assert!(prompt.contains("\"candidateKind\":\"regionReplacement\""));
        assert!(prompt.contains("Return exactly one reviewable candidate"));
        assert!(prompt.contains("Do not mark the file resolved"));
    }

    #[test]
    fn scoped_file_conflict_prompt_requests_decision_metadata() {
        let prompt = build_prompt_with_instruction(&scoped_file_context(), "Resolve the file.");

        assert!(prompt.contains("\"candidateKind\":\"fullFileResult\""));
        assert!(prompt.contains("\"details\":\"full explanation with per-region reasoning\""));
        assert!(prompt.contains("\"decisions\""));
        assert!(prompt.contains("\"selectedChoice\":\"current|incoming|combination|custom\""));
        assert!(prompt.contains("include one decisions entry for each listed conflict region"));
    }

    #[test]
    fn scoped_external_conflict_prompt_preserves_read_only_candidate_shape() {
        let prompt = build_external_agent_prompt_with_instruction(
            &scoped_region_context(),
            "Fix the selected conflict.",
        );

        assert!(prompt.contains("\"candidateKind\":\"regionReplacement\""));
        assert!(prompt.contains("Do not modify files"));
        assert!(prompt.contains("Git descriptor:"));
    }
}
