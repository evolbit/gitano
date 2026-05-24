use super::super::models::{load_preferences, reconcile_preferences_with_available_models};
use super::super::ollama::OllamaClient;
use super::super::runtime::start_managed_runtime_if_installed;
use super::super::types::{LocalAiWarmModelFailure, LocalAiWarmModelsResponse};
use super::model_helpers::keep_alive_duration;

pub(super) async fn warm_configured_models() -> Result<LocalAiWarmModelsResponse, String> {
    if load_preferences().has_external_agent_engine() {
        return Ok(LocalAiWarmModelsResponse {
            warmed_model_ids: Vec::new(),
            failures: Vec::new(),
        });
    }

    start_managed_runtime_if_installed().await?;
    let client = OllamaClient::from_env();
    let runtime = client.runtime_status().await;

    if !runtime.available {
        return Err(runtime
            .error
            .unwrap_or_else(|| "Local AI runtime is unavailable.".to_string()));
    }

    let available_model_ids = client.installed_supported_model_ids().await?;
    let preferences = reconcile_preferences_with_available_models(&available_model_ids)?;
    let keep_alive = keep_alive_duration(&preferences);
    let mut warmed_model_ids = Vec::new();
    let mut failures = Vec::new();

    for model_id in preferences.warm_model_ids {
        if !available_model_ids
            .iter()
            .any(|available| available == &model_id)
        {
            continue;
        }

        match client.warm_model(&model_id, &keep_alive).await {
            Ok(()) => warmed_model_ids.push(model_id),
            Err(error) => failures.push(LocalAiWarmModelFailure { model_id, error }),
        }
    }

    Ok(LocalAiWarmModelsResponse {
        warmed_model_ids,
        failures,
    })
}

pub(super) async fn unload_model_if_runtime_available(model_id: &str) -> Result<(), String> {
    start_managed_runtime_if_installed().await?;
    let client = OllamaClient::from_env();
    let status = client.model_status(model_id).await;

    if !status.runtime.available || !status.running {
        return Ok(());
    }

    client.unload_model(model_id).await
}

#[cfg(test)]
mod tests {
    use super::super::super::types::AnalysisEngine;
    use super::*;

    #[test]
    fn warm_configured_models_noops_for_external_engine() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        let mut preferences = super::super::super::models::default_preferences();
        preferences.analysis_engine = AnalysisEngine::ExternalAgent {
            agent_id: "codex-acp".to_string(),
        };
        preferences.warm_model_ids.push("phi4-mini".to_string());
        super::super::super::models::save_preferences(&preferences).expect("save preferences");

        let response =
            tauri::async_runtime::block_on(warm_configured_models()).expect("warm no-op succeeds");

        assert!(response.warmed_model_ids.is_empty());
        assert!(response.failures.is_empty());

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }
}
