use serde::{Deserialize, Serialize};

pub const LOCAL_AI_PROGRESS_EVENT: &str = "local-ai-progress";
pub const LOCAL_AI_RUN_PROGRESS_EVENT: &str = "local-ai-run-progress";
pub const EXTERNAL_AI_AGENT_PROGRESS_EVENT: &str = "external-ai-agent-progress";
pub const EXTERNAL_AI_RUN_EVENT: &str = "external-ai-run-event";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiEntitlementStatus {
    pub entitled: bool,
    pub source: LocalAiEntitlementSource,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiEntitlementSource {
    License,
    StaleValidation,
    Invalid,
    Missing,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiActionKind {
    CommitMessage,
    CommitAnalysis,
    BranchAnalysis,
    BranchReview,
    MergeConflictSuggestions,
}

impl LocalAiActionKind {
    pub fn as_key(self) -> &'static str {
        match self {
            Self::CommitMessage => "commitMessage",
            Self::CommitAnalysis => "commitAnalysis",
            Self::BranchAnalysis => "branchAnalysis",
            Self::BranchReview => "branchReview",
            Self::MergeConflictSuggestions => "mergeConflictSuggestions",
        }
    }

    pub fn display_label(self) -> &'static str {
        match self {
            Self::CommitMessage => "Commit",
            Self::CommitAnalysis => "Commit review",
            Self::BranchAnalysis => "Branch analysis",
            Self::BranchReview => "Branch review",
            Self::MergeConflictSuggestions => "Merge conflicts",
        }
    }

    pub fn default_prompt_instruction(self) -> &'static str {
        match self {
            Self::CommitMessage => {
                "Generate a Git commit message for the staged changes only.\n\
                 Requirements:\n\
                 - The message must be specific to the files and behavior changed.\n\
                 - Use imperative mood and keep the subject near 72 characters.\n\
                 - Prefer conventional commit style when a clear type fits: feat, fix, refactor, test, docs, chore.\n\
                 - Do not use generic messages like \"Update changes\", \"Update files\", \"Misc changes\", or \"Refactor code\"."
            }
            Self::CommitAnalysis => {
                "Analyze this commit for correctness, risk, and maintainability."
            }
            Self::BranchAnalysis => {
                "Analyze this branch or PR-style diff as a reviewer preparing to approve or question a PR.\n\
                 Focus on intent, real risks, behavioral changes, potential regressions, test gaps, recommendations, and action items.\n\
                 Do not return a raw changed-file list; the UI already shows the changed files. Mention files only when they support a concrete risk or action item.\n\
                 Do not create low-value findings. If there are no concrete findings, return an empty findings array and useful recommendations or action items if applicable.\n\
                 Keep the report focused on findings that affect review or release decisions."
            }
            Self::BranchReview => {
                "Review this branch like PR review feedback. Find changed lines that may introduce bugs, regressions, unsafe assumptions, missing validation, missing tests, or maintainability issues.\n\
                 Every inline finding must be anchored to a changed line from the diff. Use side \"new\" for added/modified new-code feedback and side \"old\" only when the deleted line itself needs attention.\n\
                 Do not summarize files. Do not produce informational cleanup comments. If there are no actionable changed-code risks, return an empty findings array and a concise summary.\n\
                 Suggested comments should be ready to paste into a PR and should ask for a concrete change or clarification.\n\
                 Include all material changed-code risks you can substantiate.\n\
                 Prioritize actionable, high-confidence findings over exhaustive or stylistic feedback."
            }
            Self::MergeConflictSuggestions => {
                "Resolve the merge conflicts conservatively and correctly.\n\
                 Preserve both sides when their changes are compatible, choose one side only when it clearly preserves the intended behavior, and avoid inventing unrelated logic.\n\
                 Do not prefer a side because it appears newer; base decisions on semantics, consistency with surrounding code, and conflict context.\n\
                 Return a concise one-sentence summary for the result status message and put the full region-by-region explanation in details."
            }
        }
    }
}
