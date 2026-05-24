use tauri::{AppHandle, Emitter};

use super::OllamaPullProgress;
use crate::ai::types::{LocalAiDownloadProgress, LocalAiProgressState, LOCAL_AI_PROGRESS_EVENT};

pub(super) fn pull_progress_to_event(
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

pub(super) fn model_download_error(model_id: &str, error: reqwest::Error) -> String {
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

pub(super) fn emit_progress(app: &AppHandle, progress: LocalAiDownloadProgress) {
    let _ = app.emit(LOCAL_AI_PROGRESS_EVENT, progress);
}
