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
    DevelopmentStub,
    License,
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
}
