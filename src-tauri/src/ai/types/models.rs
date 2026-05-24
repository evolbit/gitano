use serde::{Deserialize, Serialize};

use super::LocalAiActionKind;

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
pub enum LocalAiRunProgressState {
    ResolvingCommit,
    ReadingCommitDiff,
    ResolvingRefs,
    DeterminingDiffBase,
    ReadingComparisonDiff,
    CheckingCache,
    CacheHit,
    RunningModel,
    FormattingResult,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiRunProgress {
    pub run_id: String,
    pub action_kind: LocalAiActionKind,
    pub state: LocalAiRunProgressState,
    pub message: String,
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
