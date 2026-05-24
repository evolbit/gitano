use super::types::{
    LocalAiActionKind, LocalAiDownloadProgress, LocalAiModelStatus, LocalAiProgressState,
    LocalAiRuntimeStatus,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tauri::AppHandle;

mod generation;
mod progress;

pub use progress::emit_failed_progress;

use generation::{
    format_generation_error, format_ollama_http_error, generation_options, generation_timeout,
    runtime_unreachable_message,
};
use progress::{emit_progress, model_download_error, pull_progress_to_event};

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    #[serde(default)]
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaPsResponse {
    #[serde(default)]
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize, Clone)]
struct OllamaModel {
    #[serde(default)]
    name: String,
    #[serde(default)]
    model: String,
    #[serde(default)]
    digest: Option<String>,
    #[serde(default)]
    size: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OllamaPullProgress {
    #[serde(default)]
    status: String,
    #[serde(default)]
    completed: Option<u64>,
    #[serde(default)]
    total: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: String,
}

#[derive(Debug, Serialize)]
struct OllamaGenerateRequest<'a> {
    model: &'a str,
    prompt: &'a str,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<serde_json::Value>,
    keep_alive: &'a str,
}

#[derive(Clone)]
pub struct OllamaClient {
    endpoint: String,
    client: reqwest::Client,
}

impl OllamaClient {
    pub fn from_env() -> Self {
        Self::new(super::runtime::ollama_endpoint())
    }

    pub fn new(endpoint: String) -> Self {
        Self {
            endpoint: endpoint.trim_end_matches('/').to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn runtime_status(&self) -> LocalAiRuntimeStatus {
        if !super::runtime::using_external_ollama()
            && super::runtime::managed_runtime_binary_path().is_none()
        {
            return LocalAiRuntimeStatus {
                available: false,
                endpoint: self.endpoint.clone(),
                error: Some("Local AI setup is required.".to_string()),
            };
        }

        match self
            .client
            .get(self.url("/api/tags"))
            .timeout(Duration::from_secs(1))
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => LocalAiRuntimeStatus {
                available: true,
                endpoint: self.endpoint.clone(),
                error: None,
            },
            Ok(response) => LocalAiRuntimeStatus {
                available: false,
                endpoint: self.endpoint.clone(),
                error: Some(format!(
                    "Ollama responded at {} but returned HTTP {}.",
                    self.endpoint,
                    response.status()
                )),
            },
            Err(error) => LocalAiRuntimeStatus {
                available: false,
                endpoint: self.endpoint.clone(),
                error: Some(runtime_unreachable_message(&self.endpoint, &error)),
            },
        }
    }

    pub async fn model_status(&self, model_id: &str) -> LocalAiModelStatus {
        let runtime = self.runtime_status().await;
        if !runtime.available {
            return LocalAiModelStatus {
                runtime,
                model_id: model_id.to_string(),
                installed: false,
                digest: None,
                size_bytes: None,
                running: false,
                ready: false,
            };
        }

        let installed = self.installed_models().await.unwrap_or_default();
        let running = self.running_models().await.unwrap_or_default();
        let installed_model = installed.iter().find(|model| model.matches(model_id));
        let running_model = running.iter().find(|model| model.matches(model_id));
        let digest = installed_model
            .and_then(|model| model.digest.clone())
            .or_else(|| running_model.and_then(|model| model.digest.clone()));
        let size_bytes = installed_model
            .and_then(|model| model.size)
            .or_else(|| running_model.and_then(|model| model.size));
        let is_installed = installed_model.is_some();
        let is_running = running_model.is_some();

        LocalAiModelStatus {
            runtime,
            model_id: model_id.to_string(),
            installed: is_installed,
            digest,
            size_bytes,
            running: is_running,
            ready: is_installed,
        }
    }

    async fn installed_models(&self) -> Result<Vec<OllamaModel>, String> {
        let response = self
            .client
            .get(self.url("/api/tags"))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json::<OllamaTagsResponse>()
            .await
            .map_err(|e| e.to_string())?;

        Ok(response.models)
    }

    pub async fn installed_supported_model_ids(&self) -> Result<Vec<String>, String> {
        let installed = self.installed_models().await?;
        Ok(super::models::model_catalog()
            .into_iter()
            .filter(|model| {
                installed
                    .iter()
                    .any(|installed| installed.matches(&model.id))
            })
            .map(|model| model.id)
            .collect())
    }

    async fn running_models(&self) -> Result<Vec<OllamaModel>, String> {
        let response = self
            .client
            .get(self.url("/api/ps"))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json::<OllamaPsResponse>()
            .await
            .map_err(|e| e.to_string())?;

        Ok(response.models)
    }

    pub async fn pull_model(
        &self,
        app: AppHandle,
        operation_id: String,
        model_id: String,
    ) -> Result<(), String> {
        emit_progress(
            &app,
            LocalAiDownloadProgress {
                operation_id: operation_id.clone(),
                model_id: model_id.clone(),
                state: LocalAiProgressState::Queued,
                status: format!("Downloading model {}...", model_id),
                completed_bytes: None,
                total_bytes: None,
                percentage: None,
                error: None,
            },
        );

        let response = self
            .client
            .post(self.url("/api/pull"))
            .json(&json!({ "model": model_id, "stream": true }))
            .send()
            .await
            .map_err(|e| model_download_error(&model_id, e))?
            .error_for_status()
            .map_err(|e| model_download_error(&model_id, e))?;

        let mut stream = response.bytes_stream();
        let mut pending = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| model_download_error(&model_id, e))?;
            pending.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(index) = pending.find('\n') {
                let line = pending[..index].trim().to_string();
                pending = pending[index + 1..].to_string();

                if line.is_empty() {
                    continue;
                }

                if let Ok(progress) = serde_json::from_str::<OllamaPullProgress>(&line) {
                    emit_progress(
                        &app,
                        pull_progress_to_event(&operation_id, &model_id, progress, None),
                    );
                }
            }
        }

        if !pending.trim().is_empty() {
            if let Ok(progress) = serde_json::from_str::<OllamaPullProgress>(pending.trim()) {
                emit_progress(
                    &app,
                    pull_progress_to_event(&operation_id, &model_id, progress, None),
                );
            }
        }

        emit_progress(
            &app,
            LocalAiDownloadProgress {
                operation_id,
                model_id,
                state: LocalAiProgressState::Completed,
                status: "Model ready".to_string(),
                completed_bytes: None,
                total_bytes: None,
                percentage: Some(100.0),
                error: None,
            },
        );

        Ok(())
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<(), String> {
        let response = self
            .client
            .delete(self.url("/api/delete"))
            .json(&json!({ "model": model_id }))
            .send()
            .await
            .map_err(|e| format!("Model {} deletion failed: {}", model_id, e))?
            .error_for_status()
            .map_err(|e| format!("Model {} deletion failed: {}", model_id, e))?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!(
                "Model {} deletion failed with HTTP {}.",
                model_id,
                response.status()
            ))
        }
    }

    pub async fn generate_json(
        &self,
        model_id: &str,
        prompt: &str,
        action_kind: LocalAiActionKind,
        context_window: usize,
        keep_alive: &str,
    ) -> Result<String, String> {
        let request = OllamaGenerateRequest {
            model: model_id,
            prompt,
            stream: false,
            format: Some("json"),
            options: Some(generation_options(action_kind, context_window)),
            keep_alive,
        };

        let response = self
            .client
            .post(self.url("/api/generate"))
            .json(&request)
            .timeout(generation_timeout(action_kind))
            .send()
            .await
            .map_err(|e| format_generation_error(action_kind, e))?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format_ollama_http_error(
                "Local AI generation failed",
                status,
                &body,
            ));
        }

        let response = response
            .json::<OllamaGenerateResponse>()
            .await
            .map_err(|e| format!("Local AI response could not be parsed: {}", e))?;

        Ok(response.response)
    }

    pub async fn warm_model(&self, model_id: &str, keep_alive: &str) -> Result<(), String> {
        let request = OllamaGenerateRequest {
            model: model_id,
            prompt: "",
            stream: false,
            format: None,
            options: Some(json!({
                "num_predict": 1,
                "temperature": 0.0
            })),
            keep_alive,
        };

        self.client
            .post(self.url("/api/generate"))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Local AI warmup failed for {}: {}", model_id, e))?
            .error_for_status()
            .map_err(|e| format!("Local AI warmup failed for {}: {}", model_id, e))?;

        Ok(())
    }

    pub async fn unload_model(&self, model_id: &str) -> Result<(), String> {
        let request = OllamaGenerateRequest {
            model: model_id,
            prompt: "",
            stream: false,
            format: None,
            options: None,
            keep_alive: "0",
        };

        self.client
            .post(self.url("/api/generate"))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Local AI unload failed for {}: {}", model_id, e))?
            .error_for_status()
            .map_err(|e| format!("Local AI unload failed for {}: {}", model_id, e))?;

        Ok(())
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.endpoint, path)
    }
}

impl OllamaModel {
    fn matches(&self, model_id: &str) -> bool {
        if self.name == model_id || self.model == model_id {
            return true;
        }

        if model_id.contains(':') {
            return false;
        }

        let latest_tag = format!("{}:latest", model_id);
        self.name == latest_tag || self.model == latest_tag
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_request_serializes_keep_alive_at_top_level() {
        let request = OllamaGenerateRequest {
            model: "phi4-mini",
            prompt: "{}",
            stream: false,
            format: Some("json"),
            options: Some(json!({ "num_predict": 1 })),
            keep_alive: "30m",
        };

        let value = serde_json::to_value(request).expect("serialize request");

        assert_eq!(value["keep_alive"], "30m");
        assert_eq!(value["format"], "json");
        assert!(value["options"].is_object());
    }

    #[test]
    fn warmup_request_omits_json_format() {
        let request = OllamaGenerateRequest {
            model: "phi4-mini",
            prompt: "",
            stream: false,
            format: None,
            options: Some(json!({ "num_predict": 1 })),
            keep_alive: "30m",
        };

        let value = serde_json::to_value(request).expect("serialize request");

        assert_eq!(value["keep_alive"], "30m");
        assert!(value.get("format").is_none());
    }

    #[test]
    fn unload_request_uses_zero_keep_alive() {
        let request = OllamaGenerateRequest {
            model: "phi4-mini",
            prompt: "",
            stream: false,
            format: None,
            options: None,
            keep_alive: "0",
        };

        let value = serde_json::to_value(request).expect("serialize request");

        assert_eq!(value["keep_alive"], "0");
        assert!(value.get("format").is_none());
        assert!(value.get("options").is_none());
    }

    #[test]
    fn converts_pull_progress_to_percentage_event() {
        let event = pull_progress_to_event(
            "op",
            "qwen2.5-coder:7b",
            OllamaPullProgress {
                status: "pulling layer".to_string(),
                completed: Some(50),
                total: Some(100),
            },
            None,
        );

        assert_eq!(event.percentage, Some(50.0));
        assert_eq!(event.state, LocalAiProgressState::Downloading);
        assert_eq!(
            event.status,
            "Downloading model qwen2.5-coder:7b... pulling layer"
        );
    }

    #[test]
    fn parses_tags_response_and_matches_model_names() {
        let response: OllamaTagsResponse = serde_json::from_str(
            r#"{"models":[{"name":"qwen2.5-coder:7b","model":"qwen2.5-coder:7b","digest":"abc","size":42}]}"#,
        )
        .unwrap();

        assert_eq!(response.models.len(), 1);
        assert!(response.models[0].matches("qwen2.5-coder:7b"));
        assert_eq!(response.models[0].digest.as_deref(), Some("abc"));
    }

    #[test]
    fn parses_running_model_responses() {
        let response: OllamaPsResponse = serde_json::from_str(
            r#"{"models":[{"name":"qwen2.5-coder:7b","model":"qwen2.5-coder:7b","digest":"running","size":42}]}"#,
        )
        .unwrap();

        assert_eq!(response.models.len(), 1);
        assert!(response.models[0].matches("qwen2.5-coder:7b"));
        assert_eq!(response.models[0].digest.as_deref(), Some("running"));
    }

    #[test]
    fn parses_generate_responses() {
        let response: OllamaGenerateResponse =
            serde_json::from_str(r#"{"response":"{\"summary\":\"ok\"}"}"#).unwrap();

        assert!(response.response.contains("summary"));
    }

    #[test]
    fn rejects_generate_responses_without_response_text() {
        let error = serde_json::from_str::<OllamaGenerateResponse>(r#"{"done":true}"#)
            .expect_err("missing response should fail");

        assert!(error.to_string().contains("missing field"));
    }

    #[test]
    fn commit_message_generation_uses_short_prediction_budget() {
        let options = generation_options(LocalAiActionKind::CommitMessage, 32_768);

        assert_eq!(options["num_ctx"], 8_192);
        assert_eq!(options["num_predict"], 96);
    }

    #[test]
    fn branch_review_generation_uses_larger_prediction_budget() {
        let options = generation_options(LocalAiActionKind::BranchReview, 131_072);

        assert_eq!(options["num_ctx"], 65_536);
        assert_eq!(options["num_predict"], 4_096);
    }

    #[test]
    fn branch_analysis_generation_uses_larger_prediction_budget() {
        let options = generation_options(LocalAiActionKind::BranchAnalysis, 32_768);

        assert_eq!(options["num_ctx"], 32_768);
        assert_eq!(options["num_predict"], 3_072);
    }

    #[test]
    fn http_errors_include_ollama_error_body() {
        let error = format_ollama_http_error(
            "Local AI generation failed",
            reqwest::StatusCode::INTERNAL_SERVER_ERROR,
            r#"{"error":"runner crashed while loading model"}"#,
        );

        assert_eq!(
            error,
            "Local AI generation failed: Ollama returned HTTP 500 Internal Server Error: runner crashed while loading model"
        );
    }

    #[test]
    fn http_errors_include_metal_backend_diagnostic() {
        let error = format_ollama_http_error(
            "Local AI generation failed",
            reqwest::StatusCode::INTERNAL_SERVER_ERROR,
            r#"{"error":"llama runner process has terminated: Unable to reach MTLCompilerService. llama_init_from_model: failed to initialize the context: failed to initialize Metal backend"}"#,
        );

        assert!(error.contains("failed to initialize Metal backend"));
        assert!(error.contains("Diagnostic: Ollama's Metal runner crashed"));
        assert!(error.contains("MTLCompilerService is unavailable"));
    }

    #[test]
    fn reports_missing_managed_runtime_without_network_probe() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let previous_ollama_host = std::env::var_os("OLLAMA_HOST");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::remove_var("OLLAMA_HOST");
        let temp_dir = tempfile::tempdir().unwrap();
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        let status = tauri::async_runtime::block_on(OllamaClient::from_env().runtime_status());

        assert!(!status.available);
        assert_eq!(status.error.as_deref(), Some("Local AI setup is required."));

        match previous_ollama_host {
            Some(value) => std::env::set_var("OLLAMA_HOST", value),
            None => std::env::remove_var("OLLAMA_HOST"),
        }
        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }
}
