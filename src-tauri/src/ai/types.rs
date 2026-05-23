use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum AnalysisEngine {
    LocalModel { model_id: Option<String> },
    ExternalAgent { agent_id: String },
}

impl AnalysisEngine {
    pub fn external_agent(agent_id: impl Into<String>) -> Self {
        Self::ExternalAgent {
            agent_id: agent_id.into(),
        }
    }

    pub fn local_model_id(&self) -> Option<&str> {
        match self {
            Self::LocalModel { model_id } => model_id.as_deref(),
            Self::ExternalAgent { .. } => None,
        }
    }

    pub fn is_local_model(&self) -> bool {
        matches!(self, Self::LocalModel { .. })
    }

    pub fn is_external_agent(&self) -> bool {
        matches!(self, Self::ExternalAgent { .. })
    }
}

fn legacy_model_engine(model_id: &str) -> AnalysisEngine {
    let model_id = model_id.trim();
    AnalysisEngine::LocalModel {
        model_id: if model_id.is_empty() {
            None
        } else {
            Some(model_id.to_string())
        },
    }
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiPreferences {
    pub global_model_id: String,
    pub action_model_ids: HashMap<String, String>,
    pub analysis_engine: AnalysisEngine,
    #[serde(default)]
    pub action_engines: HashMap<String, AnalysisEngine>,
    #[serde(default)]
    pub external_agent_option_values: HashMap<String, HashMap<String, String>>,
    #[serde(default)]
    pub action_external_agent_option_values:
        HashMap<String, HashMap<String, HashMap<String, String>>>,
    #[serde(default)]
    pub warm_model_ids: Vec<String>,
    #[serde(default = "default_keep_alive_minutes")]
    pub keep_alive_minutes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalAiPreferencesWire {
    #[serde(default)]
    global_model_id: String,
    #[serde(default)]
    action_model_ids: HashMap<String, String>,
    #[serde(default)]
    analysis_engine: Option<AnalysisEngine>,
    #[serde(default)]
    action_engines: HashMap<String, AnalysisEngine>,
    #[serde(default)]
    external_agent_option_values: HashMap<String, HashMap<String, String>>,
    #[serde(default)]
    action_external_agent_option_values: HashMap<String, HashMap<String, HashMap<String, String>>>,
    #[serde(default)]
    warm_model_ids: Vec<String>,
    #[serde(default = "default_keep_alive_minutes")]
    keep_alive_minutes: u64,
}

impl<'de> Deserialize<'de> for LocalAiPreferences {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let wire = LocalAiPreferencesWire::deserialize(deserializer)?;
        let mut action_engines = wire.action_engines;
        for (action_kind, model_id) in &wire.action_model_ids {
            action_engines
                .entry(action_kind.clone())
                .or_insert_with(|| legacy_model_engine(model_id));
        }

        let mut preferences = Self {
            analysis_engine: wire
                .analysis_engine
                .unwrap_or_else(|| legacy_model_engine(&wire.global_model_id)),
            global_model_id: wire.global_model_id,
            action_model_ids: wire.action_model_ids,
            action_engines,
            external_agent_option_values: wire.external_agent_option_values,
            action_external_agent_option_values: wire.action_external_agent_option_values,
            warm_model_ids: wire.warm_model_ids,
            keep_alive_minutes: wire.keep_alive_minutes,
        };
        preferences.sync_legacy_model_fields();
        if preferences.has_external_agent_engine() {
            preferences.warm_model_ids.clear();
        }

        Ok(preferences)
    }
}

impl LocalAiPreferences {
    pub fn migrate_legacy_model_fields(&mut self) {
        if matches!(
            self.analysis_engine,
            AnalysisEngine::LocalModel { model_id: None }
        ) && !self.global_model_id.trim().is_empty()
        {
            self.analysis_engine = legacy_model_engine(&self.global_model_id);
        }

        for (action_kind, model_id) in &self.action_model_ids {
            self.action_engines
                .entry(action_kind.clone())
                .or_insert_with(|| legacy_model_engine(model_id));
        }
    }

    pub fn sync_legacy_model_fields(&mut self) {
        self.global_model_id = self
            .analysis_engine
            .local_model_id()
            .unwrap_or_default()
            .to_string();

        self.action_model_ids = self
            .action_engines
            .iter()
            .filter_map(|(action_kind, engine)| {
                engine
                    .local_model_id()
                    .map(|model_id| (action_kind.clone(), model_id.to_string()))
            })
            .collect();
    }

    pub fn has_external_agent_engine(&self) -> bool {
        self.analysis_engine.is_external_agent()
            || self
                .action_engines
                .values()
                .any(AnalysisEngine::is_external_agent)
    }
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
pub struct LocalAiSetAnalysisEnginePreferenceRequest {
    pub engine: AnalysisEngine,
    #[serde(default)]
    pub action_kind: Option<LocalAiActionKind>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ExternalAiAgentInstallKind {
    Binary,
    Npx,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentInstallSource {
    pub kind: ExternalAiAgentInstallKind,
    pub package: Option<String>,
    pub archive: Option<String>,
    pub command: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ExternalAiAgentStatusState {
    NotInstalled,
    Ready,
    Unavailable,
    UnsupportedPlatform,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentAuthMethod {
    pub id: String,
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentStatus {
    pub agent_id: String,
    pub installed: bool,
    pub authenticated: bool,
    pub available: bool,
    pub state: ExternalAiAgentStatusState,
    pub version: Option<String>,
    #[serde(default)]
    pub auth_methods: Vec<ExternalAiAgentAuthMethod>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentEntry {
    pub id: String,
    pub display_name: String,
    pub provider: String,
    pub description: String,
    pub version: String,
    pub repository: Option<String>,
    pub license: Option<String>,
    pub install_source: Option<ExternalAiAgentInstallSource>,
    pub status: ExternalAiAgentStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ExternalAiAgentProgressState {
    Queued,
    Downloading,
    Installing,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentProgress {
    pub operation_id: String,
    pub agent_id: String,
    pub state: ExternalAiAgentProgressState,
    pub status: String,
    pub completed_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub percentage: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentInstallRequest {
    pub agent_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentInstallResponse {
    pub operation_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentCommandRequest {
    pub agent_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentSessionConfigRequest {
    pub agent_id: String,
    #[serde(default)]
    pub repo_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentConfigOptionValue {
    pub value: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentConfigOption {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(rename = "type")]
    pub option_type: String,
    pub current_value: String,
    pub options: Vec<ExternalAiAgentConfigOptionValue>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentSessionConfig {
    pub agent_id: String,
    pub options: Vec<ExternalAiAgentConfigOption>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiAgentConfigPreferenceRequest {
    pub agent_id: String,
    #[serde(default)]
    pub action_kind: Option<LocalAiActionKind>,
    pub config_id: String,
    #[serde(default)]
    pub value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ExternalAiRunEventKind {
    Text,
    Thought,
    Plan,
    ToolCall,
    ToolCallUpdate,
    PermissionDenied,
    FileRead,
    Error,
    Completed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiRunEvent {
    pub run_id: String,
    pub action_kind: LocalAiActionKind,
    pub agent_id: String,
    pub kind: ExternalAiRunEventKind,
    pub message: String,
    pub raw: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiPromptRequest {
    pub agent_id: String,
    pub repo_path: String,
    pub run_id: String,
    pub action_kind: LocalAiActionKind,
    pub prompt: String,
    #[serde(default)]
    pub external_agent_option_overrides: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiPromptResponse {
    pub agent_id: String,
    pub stop_reason: String,
    pub transcript: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalAiCancelRequest {
    pub run_id: String,
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
#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
pub enum LocalAiStructuredResult {
    CommitMessage(LocalAiCommitMessageResult),
    Analysis(LocalAiAnalysisResult),
    BranchReview(LocalAiBranchReviewResult),
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
    fn serializes_run_progress_as_camel_case() {
        let progress = LocalAiRunProgress {
            run_id: "run-1".to_string(),
            action_kind: LocalAiActionKind::BranchReview,
            state: LocalAiRunProgressState::RunningModel,
            message: "Running local model".to_string(),
            error: None,
        };

        let value = serde_json::to_value(progress).unwrap();

        assert_eq!(
            value,
            serde_json::json!({
                "runId": "run-1",
                "actionKind": "branchReview",
                "state": "runningModel",
                "message": "Running local model",
                "error": null
            })
        );
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

        assert_eq!(
            preferences.analysis_engine.local_model_id(),
            Some("phi4-mini")
        );
        assert!(preferences.warm_model_ids.is_empty());
        assert_eq!(preferences.keep_alive_minutes, DEFAULT_KEEP_ALIVE_MINUTES);
    }

    #[test]
    fn deserializes_old_action_preferences_as_local_engines() {
        let preferences: LocalAiPreferences = serde_json::from_value(serde_json::json!({
            "globalModelId": "phi4-mini",
            "actionModelIds": {
                "branchAnalysis": "qwen2.5-coder:7b"
            }
        }))
        .expect("deserialize old preferences");

        assert_eq!(
            preferences
                .action_engines
                .get("branchAnalysis")
                .and_then(AnalysisEngine::local_model_id),
            Some("qwen2.5-coder:7b")
        );
    }

    #[test]
    fn deserializes_external_engine_with_empty_warm_preferences() {
        let preferences: LocalAiPreferences = serde_json::from_value(serde_json::json!({
            "analysisEngine": {
                "type": "external_agent",
                "agentId": "codex-acp"
            },
            "warmModelIds": ["phi4-mini"]
        }))
        .expect("deserialize external preferences");

        assert!(preferences.analysis_engine.is_external_agent());
        assert!(preferences.warm_model_ids.is_empty());
    }
}
