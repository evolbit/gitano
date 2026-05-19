use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const LOCAL_AI_PROGRESS_EVENT: &str = "local-ai-progress";

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
    MergeConflictSuggestions,
}

impl LocalAiActionKind {
    pub fn as_key(self) -> &'static str {
        match self {
            Self::CommitMessage => "commitMessage",
            Self::CommitAnalysis => "commitAnalysis",
            Self::BranchAnalysis => "branchAnalysis",
            Self::MergeConflictSuggestions => "mergeConflictSuggestions",
        }
    }

    pub fn display_label(self) -> &'static str {
        match self {
            Self::CommitMessage => "Commit",
            Self::CommitAnalysis => "Commit review",
            Self::BranchAnalysis => "PR / branch review",
            Self::MergeConflictSuggestions => "Merge conflicts",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiModelQualityTier {
    Fast,
    Recommended,
    Better,
    Max,
    Experimental,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiModelWarmMemoryClass {
    Small,
    Medium,
    Large,
    VeryLarge,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiModelRequirements {
    pub min_memory_gb: f64,
    pub recommended_memory_gb: f64,
    pub min_disk_free_gb: f64,
    pub recommended_disk_free_gb: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiModelEntry {
    pub id: String,
    pub display_name: String,
    pub provider: String,
    pub quality_tier: LocalAiModelQualityTier,
    pub download_size_gb: f64,
    pub context_window: usize,
    pub action_suitability: Vec<LocalAiActionKind>,
    pub warm_memory_estimate_gb: f64,
    pub warm_memory_class: LocalAiModelWarmMemoryClass,
    pub min_requirements: LocalAiModelRequirements,
    pub recommended_requirements: LocalAiModelRequirements,
}

pub const DEFAULT_KEEP_ALIVE_MINUTES: u64 = 30;

fn default_keep_alive_minutes() -> u64 {
    DEFAULT_KEEP_ALIVE_MINUTES
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiPreferences {
    pub global_model_id: String,
    pub action_model_ids: HashMap<String, String>,
    #[serde(default)]
    pub warm_model_ids: Vec<String>,
    #[serde(default = "default_keep_alive_minutes")]
    pub keep_alive_minutes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiMachineProfile {
    pub os: String,
    pub arch: String,
    pub cpu_count: usize,
    pub total_memory_gb: Option<f64>,
    pub available_memory_gb: Option<f64>,
    pub model_storage_path: String,
    pub model_storage_free_disk_gb: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiCompatibilityLevel {
    Compatible,
    Limited,
    LikelyTooLarge,
    InsufficientDisk,
    RuntimeUnavailable,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiCompatibility {
    pub model_id: String,
    pub level: LocalAiCompatibilityLevel,
    pub blocking: bool,
    pub reasons: Vec<String>,
    pub recommended_model_id: Option<String>,
    pub machine: LocalAiMachineProfile,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiRuntimeStatus {
    pub available: bool,
    pub endpoint: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiRuntimeSetupStatus {
    pub runtime: LocalAiRuntimeStatus,
    pub managed: bool,
    pub installed: bool,
    pub installed_version: Option<String>,
    pub latest_compatible_version: String,
    pub model_storage_path: String,
    pub can_install: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiModelStatus {
    pub runtime: LocalAiRuntimeStatus,
    pub model_id: String,
    pub installed: bool,
    pub digest: Option<String>,
    pub size_bytes: Option<u64>,
    pub running: bool,
    pub ready: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAiProgressState {
    Queued,
    InstallingRuntime,
    StartingRuntime,
    Downloading,
    Verifying,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiDownloadProgress {
    pub operation_id: String,
    pub model_id: String,
    pub state: LocalAiProgressState,
    pub status: String,
    pub completed_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub percentage: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiPrepareModelRequest {
    pub model_id: String,
    #[serde(default)]
    pub allow_limited: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiPrepareModelResponse {
    pub operation_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiPrepareRuntimeRequest {
    #[serde(default)]
    pub force_reinstall: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiPrepareRuntimeResponse {
    pub operation_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiSetModelPreferenceRequest {
    #[serde(default)]
    pub model_id: Option<String>,
    #[serde(default)]
    pub action_kind: Option<LocalAiActionKind>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiSetModelWarmPreferenceRequest {
    pub model_id: String,
    pub warm: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiWarmModelFailure {
    pub model_id: String,
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiWarmModelsResponse {
    pub warmed_model_ids: Vec<String>,
    pub failures: Vec<LocalAiWarmModelFailure>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiRunRequest {
    pub repo_path: String,
    pub action_kind: LocalAiActionKind,
    pub model_id: Option<String>,
    #[serde(default)]
    pub force_refresh: bool,
    pub commit_sha: Option<String>,
    pub base_ref: Option<String>,
    pub head_ref: Option<String>,
    pub comparison_mode: Option<String>,
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
    pub changed_areas: Vec<String>,
    pub findings: Vec<LocalAiFinding>,
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
#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
pub enum LocalAiStructuredResult {
    CommitMessage(LocalAiCommitMessageResult),
    Analysis(LocalAiAnalysisResult),
    ConflictSuggestions(LocalAiConflictSuggestionsResult),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_action_kind_as_camel_case() {
        let value = serde_json::to_value(LocalAiActionKind::CommitMessage).unwrap();

        assert_eq!(value, serde_json::json!("commitMessage"));
    }

    #[test]
    fn serializes_structured_result_as_tagged_camel_case() {
        let result = LocalAiStructuredResult::CommitMessage(LocalAiCommitMessageResult {
            message: "Add local AI".to_string(),
            alternatives: vec![],
        });

        let value = serde_json::to_value(result).unwrap();

        assert_eq!(
            value,
            serde_json::json!({
                "kind": "commitMessage",
                "data": {
                    "message": "Add local AI",
                    "alternatives": []
                }
            })
        );
    }

    #[test]
    fn deserializes_null_model_preference_as_clear_request() {
        let request: LocalAiSetModelPreferenceRequest = serde_json::from_value(serde_json::json!({
            "modelId": null,
            "actionKind": "commitMessage"
        }))
        .expect("deserialize request");

        assert_eq!(request.model_id, None);
        assert_eq!(request.action_kind, Some(LocalAiActionKind::CommitMessage));
    }

    #[test]
    fn deserializes_old_preferences_with_warm_defaults() {
        let preferences: LocalAiPreferences = serde_json::from_value(serde_json::json!({
            "globalModelId": "phi4-mini",
            "actionModelIds": {}
        }))
        .expect("deserialize old preferences");

        assert!(preferences.warm_model_ids.is_empty());
        assert_eq!(preferences.keep_alive_minutes, DEFAULT_KEEP_ALIVE_MINUTES);
    }
}
