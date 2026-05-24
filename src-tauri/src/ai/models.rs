mod catalog;
mod preferences;

pub use catalog::{find_model, model_catalog, NO_AI_MODELS_AVAILABLE_MESSAGE};
pub use preferences::{
    default_preferences, external_agent_effective_option_values, load_preferences,
    local_ai_data_dir, managed_ollama_model_dir, managed_ollama_runtime_dir,
    reconcile_preferences_after_model_delete, reconcile_preferences_with_available_models,
    resolve_model_id, save_preferences, set_action_prompt_override, set_analysis_engine_preference,
    set_external_agent_config_preference, set_first_downloaded_model_as_global_default,
    set_model_preference, set_warm_model_preference,
};

#[allow(dead_code)]
pub const RECOMMENDED_MODEL_ID: &str = catalog::RECOMMENDED_MODEL_ID;

#[allow(dead_code)]
pub fn preferences_path() -> std::path::PathBuf {
    preferences::preferences_path()
}
