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
            .send()
            .await
            .map_err(|e| format!("Local AI generation failed: {}", e))?;
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

fn generation_options(action_kind: LocalAiActionKind, context_window: usize) -> serde_json::Value {
    let num_ctx = match action_kind {
        LocalAiActionKind::CommitMessage => context_window.clamp(2_048, 8_192),
        LocalAiActionKind::CommitAnalysis
        | LocalAiActionKind::BranchAnalysis
        | LocalAiActionKind::BranchReview
        | LocalAiActionKind::MergeConflictSuggestions => context_window.clamp(4_096, 32_768),
    };
    let num_predict = match action_kind {
        LocalAiActionKind::CommitMessage => 96,
        LocalAiActionKind::CommitAnalysis => 1_600,
        LocalAiActionKind::BranchAnalysis => 3_072,
        LocalAiActionKind::BranchReview => 4_096,
        LocalAiActionKind::MergeConflictSuggestions => 1_800,
    };
    let temperature = match action_kind {
        LocalAiActionKind::CommitMessage => 0.1,
        LocalAiActionKind::CommitAnalysis
        | LocalAiActionKind::BranchAnalysis
        | LocalAiActionKind::BranchReview
        | LocalAiActionKind::MergeConflictSuggestions => 0.2,
    };

    json!({
        "temperature": temperature,
        "top_p": 0.85,
        "num_ctx": num_ctx,
        "num_predict": num_predict
    })
}

fn format_ollama_http_error(context: &str, status: reqwest::StatusCode, body: &str) -> String {
    let details = ollama_error_details(body);
    if details.is_empty() {
        return format!("{}: Ollama returned HTTP {}.", context, status);
    }
    if let Some(diagnostic) = ollama_diagnostic_hint(&details) {
        return format!(
            "{}: Ollama returned HTTP {}: {}\n\n{}",
            context, status, details, diagnostic
        );
    }

    format!("{}: Ollama returned HTTP {}: {}", context, status, details)
}

fn ollama_error_details(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    serde_json::from_str::<serde_json::Value>(trimmed)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.as_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| trimmed.to_string())
}

fn ollama_diagnostic_hint(details: &str) -> Option<&'static str> {
    let normalized = details.to_lowercase();
    if normalized.contains("mtlcompilerservice")
        || normalized.contains("failed to initialize metal backend")
        || normalized.contains("unable to create llama context")
    {
        return Some(
            "Diagnostic: Ollama's Metal runner crashed before generation started. This is a local Ollama/macOS Metal backend failure, not a Gitano prompt or JSON parsing error. Restart Gitano/Ollama, retry with the latest Ollama runtime, and if it persists restart macOS because MTLCompilerService is unavailable.",
        );
    }

    None
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
        let options = generation_options(LocalAiActionKind::BranchReview, 32_768);

        assert_eq!(options["num_ctx"], 32_768);
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
