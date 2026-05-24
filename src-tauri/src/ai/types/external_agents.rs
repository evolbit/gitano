use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::LocalAiActionKind;

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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiSetActionPromptOverrideRequest {
    pub action_kind: LocalAiActionKind,
    #[serde(default)]
    pub prompt: Option<String>,
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
