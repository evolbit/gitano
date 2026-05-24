use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::LocalAiActionKind;

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
    pub action_prompt_overrides: HashMap<String, String>,
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
    action_prompt_overrides: HashMap<String, String>,
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
            action_prompt_overrides: wire.action_prompt_overrides,
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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiSetAnalysisEnginePreferenceRequest {
    pub engine: AnalysisEngine,
    #[serde(default)]
    pub action_kind: Option<LocalAiActionKind>,
}
