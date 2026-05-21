use super::types::{
    LocalAiActionKind, LocalAiModelEntry, LocalAiModelQualityTier, LocalAiModelRequirements,
    LocalAiModelWarmMemoryClass, LocalAiPreferences, DEFAULT_KEEP_ALIVE_MINUTES,
};
use serde_json;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub const RECOMMENDED_MODEL_ID: &str = "qwen2.5-coder:7b";
pub const NO_AI_MODELS_AVAILABLE_MESSAGE: &str = "No AI models available";

fn requirements(
    min_memory_gb: f64,
    recommended_memory_gb: f64,
    min_disk_free_gb: f64,
    recommended_disk_free_gb: f64,
) -> LocalAiModelRequirements {
    LocalAiModelRequirements {
        min_memory_gb,
        recommended_memory_gb,
        min_disk_free_gb,
        recommended_disk_free_gb,
    }
}

fn warm_memory_class(warm_memory_estimate_gb: f64) -> LocalAiModelWarmMemoryClass {
    if warm_memory_estimate_gb <= 5.0 {
        LocalAiModelWarmMemoryClass::Small
    } else if warm_memory_estimate_gb <= 16.0 {
        LocalAiModelWarmMemoryClass::Medium
    } else if warm_memory_estimate_gb <= 32.0 {
        LocalAiModelWarmMemoryClass::Large
    } else {
        LocalAiModelWarmMemoryClass::VeryLarge
    }
}

fn warm_memory_estimate_gb(warm_memory_estimate_gb: f64) -> (f64, LocalAiModelWarmMemoryClass) {
    (
        warm_memory_estimate_gb,
        warm_memory_class(warm_memory_estimate_gb),
    )
}

fn all_actions() -> Vec<LocalAiActionKind> {
    vec![
        LocalAiActionKind::CommitMessage,
        LocalAiActionKind::CommitAnalysis,
        LocalAiActionKind::BranchAnalysis,
        LocalAiActionKind::BranchReview,
        LocalAiActionKind::MergeConflictSuggestions,
    ]
}

pub fn model_catalog() -> Vec<LocalAiModelEntry> {
    let (qwen_1_5_warm_gb, qwen_1_5_warm_class) = warm_memory_estimate_gb(2.0);
    let (qwen_3_warm_gb, qwen_3_warm_class) = warm_memory_estimate_gb(4.0);
    let (deepseek_1_3_warm_gb, deepseek_1_3_warm_class) = warm_memory_estimate_gb(2.0);
    let (qwen_7_warm_gb, qwen_7_warm_class) = warm_memory_estimate_gb(7.0);
    let (phi_4_mini_warm_gb, phi_4_mini_warm_class) = warm_memory_estimate_gb(4.0);
    let (qwen_14_warm_gb, qwen_14_warm_class) = warm_memory_estimate_gb(16.0);
    let (qwen_32_warm_gb, qwen_32_warm_class) = warm_memory_estimate_gb(34.0);
    let (qwen_3_coder_warm_gb, qwen_3_coder_warm_class) = warm_memory_estimate_gb(32.0);

    vec![
        LocalAiModelEntry {
            id: "qwen2.5-coder:1.5b".to_string(),
            display_name: "Qwen2.5 Coder 1.5B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Fast,
            download_size_gb: 1.0,
            context_window: 32_768,
            action_suitability: vec![
                LocalAiActionKind::CommitMessage,
                LocalAiActionKind::CommitAnalysis,
            ],
            warm_memory_estimate_gb: qwen_1_5_warm_gb,
            warm_memory_class: qwen_1_5_warm_class,
            min_requirements: requirements(4.0, 8.0, 2.0, 4.0),
            recommended_requirements: requirements(8.0, 8.0, 2.0, 4.0),
        },
        LocalAiModelEntry {
            id: "qwen2.5-coder:3b".to_string(),
            display_name: "Qwen2.5 Coder 3B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Fast,
            download_size_gb: 1.9,
            context_window: 32_768,
            action_suitability: vec![
                LocalAiActionKind::CommitMessage,
                LocalAiActionKind::CommitAnalysis,
            ],
            warm_memory_estimate_gb: qwen_3_warm_gb,
            warm_memory_class: qwen_3_warm_class,
            min_requirements: requirements(8.0, 8.0, 4.0, 6.0),
            recommended_requirements: requirements(8.0, 12.0, 4.0, 6.0),
        },
        LocalAiModelEntry {
            id: "deepseek-coder:1.3b".to_string(),
            display_name: "DeepSeek Coder 1.3B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Fast,
            download_size_gb: 0.8,
            context_window: 16_384,
            action_suitability: vec![
                LocalAiActionKind::CommitMessage,
                LocalAiActionKind::CommitAnalysis,
            ],
            warm_memory_estimate_gb: deepseek_1_3_warm_gb,
            warm_memory_class: deepseek_1_3_warm_class,
            min_requirements: requirements(4.0, 8.0, 2.0, 4.0),
            recommended_requirements: requirements(8.0, 8.0, 2.0, 4.0),
        },
        LocalAiModelEntry {
            id: RECOMMENDED_MODEL_ID.to_string(),
            display_name: "Qwen2.5 Coder 7B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Recommended,
            download_size_gb: 4.7,
            context_window: 32_768,
            action_suitability: all_actions(),
            warm_memory_estimate_gb: qwen_7_warm_gb,
            warm_memory_class: qwen_7_warm_class,
            min_requirements: requirements(12.0, 16.0, 8.0, 10.0),
            recommended_requirements: requirements(16.0, 16.0, 8.0, 10.0),
        },
        LocalAiModelEntry {
            id: "phi4-mini".to_string(),
            display_name: "Phi-4 Mini".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Better,
            download_size_gb: 2.5,
            context_window: 131_072,
            action_suitability: all_actions(),
            warm_memory_estimate_gb: phi_4_mini_warm_gb,
            warm_memory_class: phi_4_mini_warm_class,
            min_requirements: requirements(8.0, 12.0, 4.0, 6.0),
            recommended_requirements: requirements(12.0, 16.0, 4.0, 6.0),
        },
        LocalAiModelEntry {
            id: "qwen2.5-coder:14b".to_string(),
            display_name: "Qwen2.5 Coder 14B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Better,
            download_size_gb: 9.0,
            context_window: 32_768,
            action_suitability: all_actions(),
            warm_memory_estimate_gb: qwen_14_warm_gb,
            warm_memory_class: qwen_14_warm_class,
            min_requirements: requirements(24.0, 32.0, 14.0, 18.0),
            recommended_requirements: requirements(32.0, 32.0, 14.0, 18.0),
        },
        LocalAiModelEntry {
            id: "qwen2.5-coder:32b".to_string(),
            display_name: "Qwen2.5 Coder 32B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Max,
            download_size_gb: 19.0,
            context_window: 32_768,
            action_suitability: all_actions(),
            warm_memory_estimate_gb: qwen_32_warm_gb,
            warm_memory_class: qwen_32_warm_class,
            min_requirements: requirements(48.0, 64.0, 28.0, 34.0),
            recommended_requirements: requirements(64.0, 64.0, 28.0, 34.0),
        },
        LocalAiModelEntry {
            id: "qwen3-coder:30b".to_string(),
            display_name: "Qwen3 Coder 30B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Experimental,
            download_size_gb: 19.0,
            context_window: 262_144,
            action_suitability: all_actions(),
            warm_memory_estimate_gb: qwen_3_coder_warm_gb,
            warm_memory_class: qwen_3_coder_warm_class,
            min_requirements: requirements(48.0, 64.0, 25.0, 32.0),
            recommended_requirements: requirements(64.0, 64.0, 25.0, 32.0),
        },
    ]
}

pub fn find_model(model_id: &str) -> Option<LocalAiModelEntry> {
    model_catalog()
        .into_iter()
        .find(|model| model.id == model_id)
}

pub fn default_preferences() -> LocalAiPreferences {
    LocalAiPreferences {
        global_model_id: String::new(),
        action_model_ids: HashMap::new(),
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

    serde_json::from_str(&contents).unwrap_or_else(|_| default_preferences())
}

pub fn save_preferences(preferences: &LocalAiPreferences) -> Result<(), String> {
    let path = preferences_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let contents = serde_json::to_string_pretty(preferences).map_err(|e| e.to_string())?;
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
            preferences
                .action_model_ids
                .insert(action_kind.as_key().to_string(), model_id.to_string());
        }
        (Some(action_kind), None) => {
            preferences.action_model_ids.remove(action_kind.as_key());
        }
        (None, Some(model_id)) => {
            if find_model(model_id).is_none() {
                return Err(format!("Unsupported local AI model: {}", model_id));
            }
            preferences.global_model_id = model_id.to_string();
        }
        (None, None) => {
            return Err("Global default model must be selected.".to_string());
        }
    }

    save_preferences(&preferences)?;
    Ok(preferences)
}

pub fn set_warm_model_preference(model_id: &str, warm: bool) -> Result<LocalAiPreferences, String> {
    let mut preferences = load_preferences();
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

    preferences
        .action_model_ids
        .retain(|_, model_id| available_model_ids.iter().any(|id| id == model_id));
    preferences
        .warm_model_ids
        .retain(|model_id| available_model_ids.iter().any(|id| id == model_id));

    if available_model_ids.is_empty() {
        preferences.global_model_id.clear();
        preferences.action_model_ids.clear();
        preferences.warm_model_ids.clear();
    } else if preferences.global_model_id.trim().is_empty()
        || !available_model_ids
            .iter()
            .any(|model_id| model_id == &preferences.global_model_id)
    {
        preferences.global_model_id = available_model_ids[0].clone();
    }

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
    preferences
        .action_model_ids
        .get(action_kind.as_key())
        .filter(|model_id| !model_id.trim().is_empty())
        .cloned()
        .ok_or_else(|| format!("No AI model selected for {}", action_kind.display_label()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recommended_model_is_in_catalog() {
        let recommended = find_model(RECOMMENDED_MODEL_ID).expect("recommended model exists");

        assert_eq!(
            recommended.quality_tier,
            LocalAiModelQualityTier::Recommended
        );
        assert!(recommended
            .action_suitability
            .contains(&LocalAiActionKind::BranchAnalysis));
        assert!(recommended
            .action_suitability
            .contains(&LocalAiActionKind::BranchReview));
    }

    #[test]
    fn requested_small_models_are_in_catalog() {
        assert!(find_model("qwen2.5-coder:1.5b").is_some());
        assert!(find_model("deepseek-coder:1.3b").is_some());
        assert!(find_model("phi4-mini").is_some());
    }

    #[test]
    fn catalog_includes_warm_memory_metadata() {
        let small = find_model("qwen2.5-coder:1.5b").expect("small model exists");
        let large = find_model("qwen2.5-coder:32b").expect("large model exists");

        assert_eq!(small.warm_memory_estimate_gb, 2.0);
        assert_eq!(small.warm_memory_class, LocalAiModelWarmMemoryClass::Small);
        assert_eq!(
            large.warm_memory_class,
            LocalAiModelWarmMemoryClass::VeryLarge
        );
    }

    #[test]
    fn default_preferences_start_without_global_model() {
        assert!(default_preferences().global_model_id.is_empty());
        assert!(default_preferences().warm_model_ids.is_empty());
        assert_eq!(
            default_preferences().keep_alive_minutes,
            DEFAULT_KEEP_ALIVE_MINUTES
        );
    }

    #[test]
    fn rejects_unsupported_model_preferences() {
        let error = set_model_preference("unknown:model", None).expect_err("unsupported model");

        assert!(error.contains("Unsupported local AI model"));
    }

    #[test]
    fn empty_action_model_preference_clears_action_override() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

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

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn warm_model_preference_toggles_supported_model() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        let warmed = set_warm_model_preference("phi4-mini", true).expect("warm model");

        assert_eq!(warmed.warm_model_ids, vec!["phi4-mini"]);

        let cleared = set_warm_model_preference("phi4-mini", false).expect("clear warm model");

        assert!(cleared.warm_model_ids.is_empty());

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn first_downloaded_model_becomes_global_default() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        let updated = set_first_downloaded_model_as_global_default("phi4-mini", false)
            .expect("set first global model")
            .expect("preferences updated");

        assert_eq!(updated.global_model_id, "phi4-mini");

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn existing_downloaded_model_keeps_global_default() {
        let updated =
            set_first_downloaded_model_as_global_default("phi4-mini", true).expect("no update");

        assert!(updated.is_none());
    }

    #[test]
    fn resolving_unset_action_model_returns_action_error() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        let error = resolve_model_id(LocalAiActionKind::CommitMessage, None)
            .expect_err("action model must be selected");

        assert_eq!(error, "No AI model selected for Commit");

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn deleted_global_model_reconciles_to_remaining_model() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

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

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn available_models_reconcile_empty_global_and_stale_actions() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

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

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn available_models_reconcile_clears_preferences_when_empty() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

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

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }
}
