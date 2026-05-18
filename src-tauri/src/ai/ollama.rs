use super::types::{
    LocalAiActionKind, LocalAiDownloadProgress, LocalAiModelStatus, LocalAiProgressState,
    LocalAiRuntimeStatus, LOCAL_AI_PROGRESS_EVENT,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

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
    format: &'a str,
    options: serde_json::Value,
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

    pub async fn generate_json(
        &self,
        model_id: &str,
        prompt: &str,
        action_kind: LocalAiActionKind,
        context_window: usize,
    ) -> Result<String, String> {
        let request = OllamaGenerateRequest {
            model: model_id,
            prompt,
            stream: false,
            format: "json",
            options: generation_options(action_kind, context_window),
        };

        let response = self
            .client
            .post(self.url("/api/generate"))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Local AI generation failed: {}", e))?
            .error_for_status()
            .map_err(|e| format!("Local AI generation failed: {}", e))?
            .json::<OllamaGenerateResponse>()
            .await
            .map_err(|e| format!("Local AI response could not be parsed: {}", e))?;

        Ok(response.response)
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.endpoint, path)
    }
}

fn generation_options(action_kind: LocalAiActionKind, context_window: usize) -> serde_json::Value {
    let num_ctx = match action_kind {
        LocalAiActionKind::CommitMessage => context_window.clamp(2_048, 8_192),
        LocalAiActionKind::CommitAnalysis
        | LocalAiActionKind::BranchAnalysis
        | LocalAiActionKind::MergeConflictSuggestions => context_window.clamp(4_096, 32_768),
    };
    let num_predict = match action_kind {
        LocalAiActionKind::CommitMessage => 96,
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::BranchAnalysis => 1_400,
        LocalAiActionKind::MergeConflictSuggestions => 1_800,
    };
    let temperature = match action_kind {
        LocalAiActionKind::CommitMessage => 0.1,
        LocalAiActionKind::CommitAnalysis
        | LocalAiActionKind::BranchAnalysis
        | LocalAiActionKind::MergeConflictSuggestions => 0.2,
    };

    json!({
        "temperature": temperature,
        "top_p": 0.85,
        "num_ctx": num_ctx,
        "num_predict": num_predict
    })
}

impl OllamaModel {
    fn matches(&self, model_id: &str) -> bool {
        self.name == model_id || self.model == model_id
    }
}

fn pull_progress_to_event(
    operation_id: &str,
    model_id: &str,
    progress: OllamaPullProgress,
    error: Option<String>,
) -> LocalAiDownloadProgress {
    let percentage = match (progress.completed, progress.total) {
        (Some(completed), Some(total)) if total > 0 => {
            Some(((completed as f64 / total as f64) * 100.0).clamp(0.0, 100.0))
        }
        _ => None,
    };
    let state = if progress.status.to_lowercase().contains("verif") {
        LocalAiProgressState::Verifying
    } else {
        LocalAiProgressState::Downloading
    };

    LocalAiDownloadProgress {
        operation_id: operation_id.to_string(),
        model_id: model_id.to_string(),
        state,
        status: model_download_status(model_id, &progress.status),
        completed_bytes: progress.completed,
        total_bytes: progress.total,
        percentage,
        error,
    }
}

fn model_download_status(model_id: &str, runtime_status: &str) -> String {
    let trimmed = runtime_status.trim();

    if trimmed.is_empty() {
        return format!("Downloading model {}...", model_id);
    }

    if trimmed.to_lowercase().contains("verif") {
        return format!("Verifying model {}...", model_id);
    }

    format!("Downloading model {}... {}", model_id, trimmed)
}

pub fn emit_failed_progress(
    app: &AppHandle,
    operation_id: String,
    model_id: String,
    error: String,
) {
    emit_progress(
        app,
        LocalAiDownloadProgress {
            operation_id,
            model_id,
            state: LocalAiProgressState::Failed,
            status: "Model setup failed".to_string(),
            completed_bytes: None,
            total_bytes: None,
            percentage: None,
            error: Some(error),
        },
    );
}

fn model_download_error(model_id: &str, error: reqwest::Error) -> String {
    if error.is_timeout() {
        return format!(
            "Model {} download timed out. Check the network connection and retry.",
            model_id
        );
    }

    if error.is_connect() {
        return format!(
            "Model {} download could not connect to the local AI runtime. Retry setup.",
            model_id
        );
    }

    format!("Model {} download failed: {}", model_id, error)
}

fn emit_progress(app: &AppHandle, progress: LocalAiDownloadProgress) {
    let _ = app.emit(LOCAL_AI_PROGRESS_EVENT, progress);
}

fn runtime_unreachable_message(endpoint: &str, error: &reqwest::Error) -> String {
    if error.is_connect() {
        return format!(
            "Local AI runtime is not running at {}. Prepare the selected model, then retry.",
            endpoint
        );
    }

    if error.is_timeout() {
        return format!(
            "Ollama did not respond at {} within 5 seconds. Check that the Ollama service is healthy, then retry.",
            endpoint
        );
    }

    format!(
        "Local AI runtime is not reachable at {}: {}. Prepare the selected model, then retry.",
        endpoint, error
    )
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn reports_missing_managed_runtime_without_network_probe() {
        std::env::remove_var("OLLAMA_HOST");
        let temp_dir = tempfile::tempdir().unwrap();
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        let status = tauri::async_runtime::block_on(OllamaClient::from_env().runtime_status());

        assert!(!status.available);
        assert_eq!(status.error.as_deref(), Some("Local AI setup is required."));

        std::env::remove_var("GITANO_LOCAL_AI_HOME");
    }
}
