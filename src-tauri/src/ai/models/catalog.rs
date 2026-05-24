use super::super::types::{
    LocalAiActionKind, LocalAiModelEntry, LocalAiModelQualityTier, LocalAiModelRequirements,
    LocalAiModelWarmMemoryClass,
};

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
}
