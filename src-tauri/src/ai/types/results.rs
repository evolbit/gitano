use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::git::conflicts::types::GitConflictSignatures;

use super::LocalAiActionKind;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiRunRequest {
    pub repo_path: String,
    pub action_kind: LocalAiActionKind,
    #[serde(default)]
    pub run_id: Option<String>,
    pub model_id: Option<String>,
    #[serde(default)]
    pub force_refresh: bool,
    pub commit_sha: Option<String>,
    pub base_ref: Option<String>,
    pub head_ref: Option<String>,
    pub comparison_mode: Option<String>,
    #[serde(default)]
    pub conflict_scope: Option<LocalAiConflictScope>,
    #[serde(default)]
    pub external_agent_option_overrides: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiFindingSeverity {
    Info,
    Low,
    Medium,
    High,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiFinding {
    pub severity: LocalAiFindingSeverity,
    pub title: String,
    pub explanation: String,
    pub file_path: Option<String>,
    pub line: Option<usize>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiCommitMessageResult {
    pub message: String,
    pub alternatives: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiAnalysisResult {
    pub summary: String,
    pub risk_assessment: Option<String>,
    #[serde(default)]
    pub changed_areas: Vec<String>,
    #[serde(default)]
    pub behavioral_changes: Vec<String>,
    #[serde(default)]
    pub potential_regressions: Vec<String>,
    #[serde(default)]
    pub test_gaps: Vec<String>,
    #[serde(default)]
    pub recommendations: Vec<String>,
    #[serde(default)]
    pub action_items: Vec<String>,
    pub findings: Vec<LocalAiFinding>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiReviewLineSide {
    Old,
    New,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiReviewConfidence {
    Low,
    Medium,
    High,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiBranchReviewFinding {
    pub severity: LocalAiFindingSeverity,
    pub confidence: LocalAiReviewConfidence,
    pub title: String,
    pub explanation: String,
    pub impact: String,
    pub recommendation: String,
    pub suggested_comment: String,
    pub file_path: String,
    pub side: LocalAiReviewLineSide,
    pub line: usize,
    pub end_line: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiBranchReviewNote {
    pub severity: LocalAiFindingSeverity,
    pub confidence: LocalAiReviewConfidence,
    pub title: String,
    pub explanation: String,
    pub recommendation: String,
    pub suggested_comment: Option<String>,
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiBranchReviewResult {
    pub summary: String,
    pub findings: Vec<LocalAiBranchReviewFinding>,
    pub notes: Vec<LocalAiBranchReviewNote>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiConflictFileSuggestion {
    pub file_path: String,
    pub summary: String,
    pub suggestion: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiConflictSuggestionsResult {
    pub summary: String,
    pub files: Vec<LocalAiConflictFileSuggestion>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LocalAiConflictScope {
    Region {
        file_path: String,
        region_id: String,
    },
    File {
        file_path: String,
    },
}

impl LocalAiConflictScope {
    pub fn file_path(&self) -> &str {
        match self {
            Self::Region { file_path, .. } | Self::File { file_path } => file_path,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LocalAiConflictCandidate {
    RegionReplacement {
        scope: LocalAiConflictScope,
        summary: String,
        replacement: String,
        input_signatures: GitConflictSignatures,
    },
    FullFileResult {
        scope: LocalAiConflictScope,
        summary: String,
        content: String,
        input_signatures: GitConflictSignatures,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiConflictCandidateResult {
    pub file_path: String,
    pub scope: LocalAiConflictScope,
    pub summary: String,
    pub candidate: LocalAiConflictCandidate,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalAiConflictCandidateInput {
    pub scope: LocalAiConflictScope,
    pub signatures: GitConflictSignatures,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
pub enum LocalAiStructuredResult {
    CommitMessage(LocalAiCommitMessageResult),
    Analysis(LocalAiAnalysisResult),
    BranchReview(LocalAiBranchReviewResult),
    ConflictSuggestions(LocalAiConflictSuggestionsResult),
    ConflictCandidate(LocalAiConflictCandidateResult),
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiRunMetadata {
    pub omitted_files: Vec<String>,
    pub omitted_sections: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiRunResult {
    pub action_kind: LocalAiActionKind,
    pub model_id: String,
    pub model_digest: String,
    pub prompt_version: String,
    pub input_digest: String,
    pub from_cache: bool,
    pub metadata: LocalAiRunMetadata,
    pub result: LocalAiStructuredResult,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiCacheEntry {
    pub key: String,
    pub created_at_ms: i64,
    pub result: LocalAiRunResult,
}
