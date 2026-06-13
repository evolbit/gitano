use super::super::types::{
    AnalysisEngine, LocalAiActionKind, LocalAiPreferences, DEFAULT_KEEP_ALIVE_MINUTES,
};
use super::catalog::find_model;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub fn default_preferences() -> LocalAiPreferences {
    LocalAiPreferences {
        global_model_id: String::new(),
        action_model_ids: HashMap::new(),
        analysis_engine: AnalysisEngine::LocalModel { model_id: None },
        action_engines: HashMap::new(),
        external_agent_option_values: HashMap::new(),
        action_external_agent_option_values: HashMap::new(),
        action_prompt_overrides: HashMap::new(),
        default_action_prompts: super::super::types::default_action_prompts(),
        warm_model_ids: Vec::new(),
        keep_alive_minutes: DEFAULT_KEEP_ALIVE_MINUTES,
    }
}

fn app_data_dir() -> PathBuf {
    if let Ok(path) = std::env::var("GITANO_LOCAL_AI_HOME") {
        return PathBuf::from(path);
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    Path::new(&home).join(".gitano").join("local-ai")
}

pub fn local_ai_data_dir() -> PathBuf {
    app_data_dir()
}

pub fn managed_ollama_runtime_dir() -> PathBuf {
    app_data_dir().join("runtime").join("ollama")
}

pub fn managed_ollama_model_dir() -> PathBuf {
    app_data_dir().join("models").join("ollama")
}

pub fn preferences_path() -> PathBuf {
    app_data_dir().join("preferences.json")
}

pub fn load_preferences() -> LocalAiPreferences {
    let path = preferences_path();
    let Ok(contents) = fs::read_to_string(path) else {
        return default_preferences();
    };

    let mut preferences: LocalAiPreferences =
        serde_json::from_str(&contents).unwrap_or_else(|_| default_preferences());
    preferences.migrate_legacy_model_fields();
    sanitize_external_agent_option_values(&mut preferences);
    preferences.sync_legacy_model_fields();
    preferences
}

pub fn save_preferences(preferences: &LocalAiPreferences) -> Result<(), String> {
    let mut preferences = preferences.clone();
    preferences.migrate_legacy_model_fields();
    sanitize_external_agent_option_values(&mut preferences);
    if preferences.has_external_agent_engine() {
        preferences.warm_model_ids.clear();
    }
    preferences.sync_legacy_model_fields();
    preferences.default_action_prompts.clear();
    let path = preferences_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let contents = serde_json::to_string_pretty(&preferences).map_err(|e| e.to_string())?;
    fs::write(path, contents).map_err(|e| e.to_string())
}

pub fn set_model_preference(
    model_id: &str,
    action_kind: Option<LocalAiActionKind>,
) -> Result<LocalAiPreferences, String> {
    let mut preferences = load_preferences();
    let model_id = model_id.trim();
    let model_id = if model_id.is_empty() {
        None
    } else {
        Some(model_id)
    };

    match (action_kind, model_id) {
        (Some(action_kind), Some(model_id)) => {
            if find_model(model_id).is_none() {
                return Err(format!("Unsupported local AI model: {}", model_id));
            }
            preferences.action_engines.insert(
                action_kind.as_key().to_string(),
                AnalysisEngine::LocalModel {
                    model_id: Some(model_id.to_string()),
                },
            );
        }
        (Some(action_kind), None) => {
            preferences.action_engines.remove(action_kind.as_key());
        }
        (None, Some(model_id)) => {
            if find_model(model_id).is_none() {
                return Err(format!("Unsupported local AI model: {}", model_id));
            }
            preferences.analysis_engine = AnalysisEngine::LocalModel {
                model_id: Some(model_id.to_string()),
            };
        }
        (None, None) => {
            return Err("Global default model must be selected.".to_string());
        }
    }

    preferences.sync_legacy_model_fields();
    save_preferences(&preferences)?;
    Ok(preferences)
}

pub fn set_analysis_engine_preference(
    engine: AnalysisEngine,
    action_kind: Option<LocalAiActionKind>,
) -> Result<LocalAiPreferences, String> {
    validate_analysis_engine(&engine)?;
    let mut preferences = load_preferences();
    let should_clear_warm = engine.is_external_agent();

    match action_kind {
        Some(action_kind) => {
            preferences
                .action_engines
                .insert(action_kind.as_key().to_string(), engine);
        }
        None => {
            preferences.analysis_engine = engine;
        }
    }

    if should_clear_warm {
        preferences.warm_model_ids.clear();
    }

    preferences.sync_legacy_model_fields();
    save_preferences(&preferences)?;
    Ok(preferences)
}

pub fn set_external_agent_config_preference(
    agent_id: &str,
    action_kind: Option<LocalAiActionKind>,
    config_id: &str,
    value: Option<&str>,
) -> Result<LocalAiPreferences, String> {
    let agent_id = agent_id.trim();
    if agent_id.is_empty() {
        return Err("External agent id must be selected.".to_string());
    }

    let config_id = config_id.trim();
    if config_id.is_empty() {
        return Err("External agent config id must be selected.".to_string());
    }

    let value = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);
    let mut preferences = load_preferences();

    match action_kind {
        Some(action_kind) => {
            let action_key = action_kind.as_key().to_string();
            match value {
                Some(value) => {
                    preferences
                        .action_external_agent_option_values
                        .entry(action_key)
                        .or_default()
                        .entry(agent_id.to_string())
                        .or_default()
                        .insert(config_id.to_string(), value);
                }
                None => {
                    if let Some(agent_values_by_action) = preferences
                        .action_external_agent_option_values
                        .get_mut(action_kind.as_key())
                    {
                        if let Some(agent_values) = agent_values_by_action.get_mut(agent_id) {
                            agent_values.remove(config_id);
                            if agent_values.is_empty() {
                                agent_values_by_action.remove(agent_id);
                            }
                        }
                        if agent_values_by_action.is_empty() {
                            preferences
                                .action_external_agent_option_values
                                .remove(action_kind.as_key());
                        }
                    }
                }
            }
        }
        None => match value {
            Some(value) => {
                preferences
                    .external_agent_option_values
                    .entry(agent_id.to_string())
                    .or_default()
                    .insert(config_id.to_string(), value);
            }
            None => {
                if let Some(agent_values) =
                    preferences.external_agent_option_values.get_mut(agent_id)
                {
                    agent_values.remove(config_id);
                    if agent_values.is_empty() {
                        preferences.external_agent_option_values.remove(agent_id);
                    }
                }
            }
        },
    }

    save_preferences(&preferences)?;
    Ok(preferences)
}

pub fn set_action_prompt_override(
    action_kind: LocalAiActionKind,
    prompt: Option<&str>,
) -> Result<LocalAiPreferences, String> {
    let mut preferences = load_preferences();
    let action_key = action_kind.as_key();
    match prompt.map(str::trim).filter(|prompt| !prompt.is_empty()) {
        Some(prompt) => {
            preferences
                .action_prompt_overrides
                .insert(action_key.to_string(), prompt.to_string());
        }
        None => {
            preferences.action_prompt_overrides.remove(action_key);
        }
    }

    save_preferences(&preferences)?;
    Ok(preferences)
}

pub fn external_agent_effective_option_values(
    preferences: &LocalAiPreferences,
    agent_id: &str,
    action_kind: LocalAiActionKind,
    overrides: &HashMap<String, String>,
) -> HashMap<String, String> {
    let mut values = preferences
        .external_agent_option_values
        .get(agent_id)
        .cloned()
        .unwrap_or_default();

    if let Some(action_values) = preferences
        .action_external_agent_option_values
        .get(action_kind.as_key())
        .and_then(|agents| agents.get(agent_id))
    {
        values.extend(action_values.clone());
    }

    values.extend(overrides.iter().filter_map(|(config_id, value)| {
        let config_id = config_id.trim();
        let value = value.trim();
        if config_id.is_empty() || value.is_empty() || read_only_external_agent_config_id(config_id)
        {
            None
        } else {
            Some((config_id.to_string(), value.to_string()))
        }
    }));
    values.retain(|config_id, _| !read_only_external_agent_config_id(config_id));

    values
}

fn sanitize_external_agent_option_values(preferences: &mut LocalAiPreferences) {
    preferences
        .external_agent_option_values
        .retain(|_, values| retain_supported_external_agent_options(values));
    preferences
        .action_external_agent_option_values
        .retain(|_, agent_values| {
            agent_values.retain(|_, values| retain_supported_external_agent_options(values));
            !agent_values.is_empty()
        });
}

fn retain_supported_external_agent_options(values: &mut HashMap<String, String>) -> bool {
    values.retain(|config_id, value| {
        !value.trim().is_empty() && !read_only_external_agent_config_id(config_id)
    });
    !values.is_empty()
}

fn read_only_external_agent_config_id(config_id: &str) -> bool {
    matches!(config_id.trim(), "allow_all" | "mode")
}

fn validate_analysis_engine(engine: &AnalysisEngine) -> Result<(), String> {
    match engine {
        AnalysisEngine::LocalModel { model_id } => {
            let Some(model_id) = model_id
                .as_deref()
                .map(str::trim)
                .filter(|id| !id.is_empty())
            else {
                return Ok(());
            };
            if find_model(model_id).is_some() {
                Ok(())
            } else {
                Err(format!("Unsupported local AI model: {}", model_id))
            }
        }
        AnalysisEngine::ExternalAgent { agent_id } => {
            let agent_id = agent_id.trim();
            if agent_id.is_empty() {
                Err("External agent id must be selected.".to_string())
            } else {
                Ok(())
            }
        }
    }
}

pub fn set_warm_model_preference(model_id: &str, warm: bool) -> Result<LocalAiPreferences, String> {
    let mut preferences = load_preferences();
    if preferences.has_external_agent_engine() {
        return Err("Model warmup is only available for local model engines.".to_string());
    }

    let model_id = model_id.trim();
    if find_model(model_id).is_none() {
        return Err(format!("Unsupported local AI model: {}", model_id));
    }

    if warm {
        if !preferences
            .warm_model_ids
            .iter()
            .any(|warm_model_id| warm_model_id == model_id)
        {
            preferences.warm_model_ids.push(model_id.to_string());
        }
    } else {
        preferences
            .warm_model_ids
            .retain(|warm_model_id| warm_model_id != model_id);
    }

    save_preferences(&preferences)?;
    Ok(preferences)
}

pub fn set_first_downloaded_model_as_global_default(
    model_id: &str,
    had_downloaded_models: bool,
) -> Result<Option<LocalAiPreferences>, String> {
    if had_downloaded_models {
        return Ok(None);
    }

    set_model_preference(model_id, None).map(Some)
}

pub fn reconcile_preferences_with_available_models(
    available_model_ids: &[String],
) -> Result<LocalAiPreferences, String> {
    let mut preferences = load_preferences();

    preferences.action_engines.retain(|_, engine| match engine {
        AnalysisEngine::LocalModel { model_id } => model_id.as_ref().map_or(true, |model_id| {
            available_model_ids.iter().any(|id| id == model_id)
        }),
        AnalysisEngine::ExternalAgent { .. } => true,
    });
    preferences
        .warm_model_ids
        .retain(|model_id| available_model_ids.iter().any(|id| id == model_id));

    if preferences.has_external_agent_engine() {
        preferences.warm_model_ids.clear();
    } else if available_model_ids.is_empty() {
        preferences.analysis_engine = AnalysisEngine::LocalModel { model_id: None };
        preferences.action_engines.clear();
        preferences.warm_model_ids.clear();
    } else if preferences
        .analysis_engine
        .local_model_id()
        .map_or(true, |model_id| {
            !available_model_ids.iter().any(|id| id == model_id)
        })
    {
        preferences.analysis_engine = AnalysisEngine::LocalModel {
            model_id: Some(available_model_ids[0].clone()),
        };
    }

    preferences.sync_legacy_model_fields();
    save_preferences(&preferences)?;
    Ok(preferences)
}

pub fn reconcile_preferences_after_model_delete(
    _deleted_model_id: &str,
    remaining_model_ids: &[String],
) -> Result<LocalAiPreferences, String> {
    reconcile_preferences_with_available_models(remaining_model_ids)
}

pub fn resolve_model_id(
    action_kind: LocalAiActionKind,
    explicit_model_id: Option<&str>,
) -> Result<String, String> {
    if let Some(model_id) = explicit_model_id
        .map(str::trim)
        .filter(|model_id| !model_id.is_empty())
    {
        return Ok(model_id.to_string());
    }

    let preferences = load_preferences();
    let engine = preferences
        .action_engines
        .get(action_kind.as_key())
        .ok_or_else(|| format!("No AI model selected for {}", action_kind.display_label()))?;

    match engine {
        AnalysisEngine::LocalModel { model_id } => model_id
            .as_deref()
            .filter(|model_id| !model_id.trim().is_empty())
            .map(str::to_string)
            .ok_or_else(|| format!("No AI model selected for {}", action_kind.display_label())),
        AnalysisEngine::ExternalAgent { agent_id } => Err(format!(
            "Selected analysis engine {} is not a local model for {}.",
            agent_id,
            action_kind.display_label()
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_temp_local_ai_home(test: impl FnOnce()) {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        test();

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn default_preferences_start_without_global_model() {
        assert!(default_preferences().global_model_id.is_empty());
        assert!(default_preferences().warm_model_ids.is_empty());
        assert_eq!(
            default_preferences()
                .default_action_prompts
                .get(LocalAiActionKind::MergeConflictSuggestions.as_key())
                .map(String::as_str),
            Some(LocalAiActionKind::MergeConflictSuggestions.default_prompt_instruction())
        );
        assert_eq!(
            default_preferences().keep_alive_minutes,
            DEFAULT_KEEP_ALIVE_MINUTES
        );
    }

    #[test]
    fn saved_preferences_do_not_persist_default_prompts() {
        with_temp_local_ai_home(|| {
            let preferences = default_preferences();

            save_preferences(&preferences).expect("save preferences");

            let contents = fs::read_to_string(preferences_path()).expect("read saved preferences");
            assert!(!contents.contains("defaultActionPrompts"));
            assert_eq!(
                load_preferences()
                    .default_action_prompts
                    .get(LocalAiActionKind::MergeConflictSuggestions.as_key())
                    .map(String::as_str),
                Some(LocalAiActionKind::MergeConflictSuggestions.default_prompt_instruction())
            );
        });
    }

    #[test]
    fn rejects_unsupported_model_preferences() {
        let error = set_model_preference("unknown:model", None).expect_err("unsupported model");

        assert!(error.contains("Unsupported local AI model"));
    }

    #[test]
    fn empty_action_model_preference_clears_action_override() {
        with_temp_local_ai_home(|| {
            let mut preferences = default_preferences();
            preferences.action_model_ids.insert(
                LocalAiActionKind::BranchAnalysis.as_key().to_string(),
                "qwen2.5-coder:1.5b".to_string(),
            );
            save_preferences(&preferences).expect("save preferences");

            let updated = set_model_preference("", Some(LocalAiActionKind::BranchAnalysis))
                .expect("clear action preference");

            assert!(!updated
                .action_model_ids
                .contains_key(LocalAiActionKind::BranchAnalysis.as_key()));
        });
    }

    #[test]
    fn warm_model_preference_toggles_supported_model() {
        with_temp_local_ai_home(|| {
            let warmed = set_warm_model_preference("phi4-mini", true).expect("warm model");

            assert_eq!(warmed.warm_model_ids, vec!["phi4-mini"]);

            let cleared = set_warm_model_preference("phi4-mini", false).expect("clear warm model");

            assert!(cleared.warm_model_ids.is_empty());
        });
    }

    #[test]
    fn action_prompt_override_saves_and_clears_trimmed_prompt() {
        with_temp_local_ai_home(|| {
            let saved = set_action_prompt_override(
                LocalAiActionKind::BranchReview,
                Some("  Focus on security risks.  "),
            )
            .expect("save prompt override");
            assert_eq!(
                saved
                    .action_prompt_overrides
                    .get(LocalAiActionKind::BranchReview.as_key())
                    .map(String::as_str),
                Some("Focus on security risks.")
            );

            let cleared = set_action_prompt_override(LocalAiActionKind::BranchReview, Some("   "))
                .expect("clear prompt override");
            assert!(!cleared
                .action_prompt_overrides
                .contains_key(LocalAiActionKind::BranchReview.as_key()));
        });
    }

    #[test]
    fn external_agent_effective_options_drop_read_only_mode_values() {
        let mut preferences = default_preferences();
        preferences.external_agent_option_values.insert(
            "github-copilot-cli".to_string(),
            HashMap::from([
                (
                    "mode".to_string(),
                    "https://agentclientprotocol.com/protocol/session-modes#autopilot".to_string(),
                ),
                ("model".to_string(), "copilot-sonnet".to_string()),
            ]),
        );
        preferences.action_external_agent_option_values.insert(
            LocalAiActionKind::BranchReview.as_key().to_string(),
            HashMap::from([(
                "github-copilot-cli".to_string(),
                HashMap::from([
                    ("allow_all".to_string(), "on".to_string()),
                    ("mode".to_string(), "agent".to_string()),
                ]),
            )]),
        );

        let values = external_agent_effective_option_values(
            &preferences,
            "github-copilot-cli",
            LocalAiActionKind::BranchReview,
            &HashMap::from([("mode".to_string(), "autopilot".to_string())]),
        );

        assert_eq!(
            values,
            HashMap::from([("model".to_string(), "copilot-sonnet".to_string())])
        );
    }

    #[test]
    fn saved_preferences_prune_read_only_external_agent_options() {
        with_temp_local_ai_home(|| {
            let mut preferences = default_preferences();
            preferences.external_agent_option_values.insert(
                "github-copilot-cli".to_string(),
                HashMap::from([
                    ("mode".to_string(), "autopilot".to_string()),
                    ("model".to_string(), "copilot-sonnet".to_string()),
                ]),
            );

            save_preferences(&preferences).expect("save preferences");
            let loaded = load_preferences();

            assert_eq!(
                loaded
                    .external_agent_option_values
                    .get("github-copilot-cli")
                    .and_then(|values| values.get("model"))
                    .map(String::as_str),
                Some("copilot-sonnet")
            );
            assert!(!loaded
                .external_agent_option_values
                .get("github-copilot-cli")
                .is_some_and(|values| values.contains_key("mode")));
        });
    }

    #[test]
    fn external_global_engine_clears_warm_preferences() {
        with_temp_local_ai_home(|| {
            let mut preferences = default_preferences();
            preferences.analysis_engine = AnalysisEngine::LocalModel {
                model_id: Some("phi4-mini".to_string()),
            };
            preferences.warm_model_ids.push("phi4-mini".to_string());
            save_preferences(&preferences).expect("save preferences");

            let updated = set_analysis_engine_preference(
                AnalysisEngine::ExternalAgent {
                    agent_id: "codex-acp".to_string(),
                },
                None,
            )
            .expect("set external engine");

            assert!(updated.warm_model_ids.is_empty());
            assert!(updated.analysis_engine.is_external_agent());
        });
    }

    #[test]
    fn external_action_engine_clears_warm_preferences() {
        with_temp_local_ai_home(|| {
            let mut preferences = default_preferences();
            preferences.analysis_engine = AnalysisEngine::LocalModel {
                model_id: Some("phi4-mini".to_string()),
            };
            preferences.warm_model_ids.push("phi4-mini".to_string());
            save_preferences(&preferences).expect("save preferences");

            let updated = set_analysis_engine_preference(
                AnalysisEngine::ExternalAgent {
                    agent_id: "codex-acp".to_string(),
                },
                Some(LocalAiActionKind::BranchAnalysis),
            )
            .expect("set external action engine");

            assert!(updated.warm_model_ids.is_empty());
            assert!(updated.has_external_agent_engine());
        });
    }

    #[test]
    fn warm_model_preference_rejects_external_engine() {
        with_temp_local_ai_home(|| {
            let mut preferences = default_preferences();
            preferences.analysis_engine = AnalysisEngine::ExternalAgent {
                agent_id: "codex-acp".to_string(),
            };
            save_preferences(&preferences).expect("save preferences");

            let error = set_warm_model_preference("phi4-mini", true)
                .expect_err("external engines cannot warm models");

            assert!(error.contains("only available for local model engines"));
        });
    }

    #[test]
    fn first_downloaded_model_becomes_global_default() {
        with_temp_local_ai_home(|| {
            let updated = set_first_downloaded_model_as_global_default("phi4-mini", false)
                .expect("set first global model")
                .expect("preferences updated");

            assert_eq!(updated.global_model_id, "phi4-mini");
        });
    }

    #[test]
    fn existing_downloaded_model_keeps_global_default() {
        let updated =
            set_first_downloaded_model_as_global_default("phi4-mini", true).expect("no update");

        assert!(updated.is_none());
    }

    #[test]
    fn resolving_unset_action_model_returns_action_error() {
        with_temp_local_ai_home(|| {
            let error = resolve_model_id(LocalAiActionKind::CommitMessage, None)
                .expect_err("action model must be selected");

            assert_eq!(error, "No AI model selected for Commit");
        });
    }

    #[test]
    fn deleted_global_model_reconciles_to_remaining_model() {
        with_temp_local_ai_home(|| {
            let mut preferences = default_preferences();
            preferences.global_model_id = "phi4-mini".to_string();
            preferences.action_model_ids.insert(
                LocalAiActionKind::CommitMessage.as_key().to_string(),
                "phi4-mini".to_string(),
            );
            preferences.warm_model_ids.push("phi4-mini".to_string());
            save_preferences(&preferences).expect("save preferences");

            let updated = reconcile_preferences_after_model_delete(
                "phi4-mini",
                &["qwen2.5-coder:1.5b".to_string()],
            )
            .expect("reconcile preferences");

            assert_eq!(updated.global_model_id, "qwen2.5-coder:1.5b");
            assert!(updated.warm_model_ids.is_empty());
        });
    }

    #[test]
    fn available_models_reconcile_empty_global_and_stale_actions() {
        with_temp_local_ai_home(|| {
            let mut preferences = default_preferences();
            preferences.action_model_ids.insert(
                LocalAiActionKind::CommitMessage.as_key().to_string(),
                "phi4-mini".to_string(),
            );
            preferences.action_model_ids.insert(
                LocalAiActionKind::BranchAnalysis.as_key().to_string(),
                "qwen2.5-coder:1.5b".to_string(),
            );
            save_preferences(&preferences).expect("save preferences");

            let updated = reconcile_preferences_with_available_models(&["phi4-mini".to_string()])
                .expect("reconcile preferences");

            assert_eq!(updated.global_model_id, "phi4-mini");
            assert_eq!(
                updated
                    .action_model_ids
                    .get(LocalAiActionKind::CommitMessage.as_key()),
                Some(&"phi4-mini".to_string())
            );
            assert!(!updated
                .action_model_ids
                .contains_key(LocalAiActionKind::BranchAnalysis.as_key()));
        });
    }

    #[test]
    fn available_models_reconcile_clears_preferences_when_empty() {
        with_temp_local_ai_home(|| {
            let mut preferences = default_preferences();
            preferences.global_model_id = "phi4-mini".to_string();
            preferences.action_model_ids.insert(
                LocalAiActionKind::CommitMessage.as_key().to_string(),
                "phi4-mini".to_string(),
            );
            preferences.warm_model_ids.push("phi4-mini".to_string());
            save_preferences(&preferences).expect("save preferences");

            let updated =
                reconcile_preferences_with_available_models(&[]).expect("reconcile preferences");

            assert!(updated.global_model_id.is_empty());
            assert!(updated.action_model_ids.is_empty());
            assert!(updated.warm_model_ids.is_empty());
        });
    }
}
