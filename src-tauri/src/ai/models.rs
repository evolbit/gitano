use super::types::{
    LocalAiActionKind, LocalAiModelEntry, LocalAiModelQualityTier, LocalAiModelRequirements,
    LocalAiPreferences,
};
use serde_json;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub const RECOMMENDED_MODEL_ID: &str = "qwen2.5-coder:7b";

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

fn all_actions() -> Vec<LocalAiActionKind> {
    vec![
        LocalAiActionKind::CommitMessage,
        LocalAiActionKind::CommitAnalysis,
        LocalAiActionKind::BranchAnalysis,
        LocalAiActionKind::MergeConflictSuggestions,
    ]
}

pub fn model_catalog() -> Vec<LocalAiModelEntry> {
    vec![
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
            min_requirements: requirements(8.0, 8.0, 4.0, 6.0),
            recommended_requirements: requirements(8.0, 12.0, 4.0, 6.0),
        },
        LocalAiModelEntry {
            id: RECOMMENDED_MODEL_ID.to_string(),
            display_name: "Qwen2.5 Coder 7B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Recommended,
            download_size_gb: 4.7,
            context_window: 32_768,
            action_suitability: all_actions(),
            min_requirements: requirements(12.0, 16.0, 8.0, 10.0),
            recommended_requirements: requirements(16.0, 16.0, 8.0, 10.0),
        },
        LocalAiModelEntry {
            id: "qwen2.5-coder:14b".to_string(),
            display_name: "Qwen2.5 Coder 14B".to_string(),
            provider: "Ollama".to_string(),
            quality_tier: LocalAiModelQualityTier::Better,
            download_size_gb: 9.0,
            context_window: 32_768,
            action_suitability: all_actions(),
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
        global_model_id: RECOMMENDED_MODEL_ID.to_string(),
        action_model_ids: HashMap::new(),
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
    if find_model(model_id).is_none() {
        return Err(format!("Unsupported local AI model: {}", model_id));
    }

    let mut preferences = load_preferences();

    if let Some(action_kind) = action_kind {
        preferences
            .action_model_ids
            .insert(action_kind.as_key().to_string(), model_id.to_string());
    } else {
        preferences.global_model_id = model_id.to_string();
    }

    save_preferences(&preferences)?;
    Ok(preferences)
}

pub fn resolve_model_id(action_kind: LocalAiActionKind, explicit_model_id: Option<&str>) -> String {
    if let Some(model_id) = explicit_model_id {
        return model_id.to_string();
    }

    let preferences = load_preferences();
    preferences
        .action_model_ids
        .get(action_kind.as_key())
        .cloned()
        .unwrap_or(preferences.global_model_id)
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
    }

    #[test]
    fn default_preferences_use_recommended_model() {
        assert_eq!(default_preferences().global_model_id, RECOMMENDED_MODEL_ID);
    }

    #[test]
    fn rejects_unsupported_model_preferences() {
        let error = set_model_preference("unknown:model", None).expect_err("unsupported model");

        assert!(error.contains("Unsupported local AI model"));
    }
}
