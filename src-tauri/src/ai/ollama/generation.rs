use std::time::Duration;

use serde_json::json;

use crate::ai::context_window::{effective_context_window, generation_num_predict};
use crate::ai::types::LocalAiActionKind;

pub(super) fn generation_options(
    action_kind: LocalAiActionKind,
    context_window: usize,
) -> serde_json::Value {
    let num_ctx = effective_context_window(action_kind, context_window);
    let num_predict = generation_num_predict(action_kind);
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

pub(super) fn generation_timeout(action_kind: LocalAiActionKind) -> Duration {
    match action_kind {
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            Duration::from_secs(8 * 60)
        }
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::MergeConflictSuggestions => {
            Duration::from_secs(5 * 60)
        }
        LocalAiActionKind::CommitMessage => Duration::from_secs(2 * 60),
    }
}

pub(super) fn format_generation_error(
    action_kind: LocalAiActionKind,
    error: reqwest::Error,
) -> String {
    if error.is_timeout() {
        return format!(
            "Local AI {} timed out after {} minutes. Try a smaller comparison or a lighter local model.",
            action_kind.display_label().to_lowercase(),
            generation_timeout(action_kind).as_secs() / 60
        );
    }

    format!("Local AI generation failed: {}", error)
}

pub(super) fn format_ollama_http_error(
    context: &str,
    status: reqwest::StatusCode,
    body: &str,
) -> String {
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

pub(super) fn runtime_unreachable_message(endpoint: &str, error: &reqwest::Error) -> String {
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
