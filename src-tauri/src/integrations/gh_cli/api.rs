use super::runner::{GhCommand, GhOutput, GhRunner, ProcessGhRunner};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::Path;

pub(super) fn non_empty_stderr(output: &GhOutput) -> Option<String> {
    let stderr = output.stderr.trim();
    if !stderr.is_empty() {
        return Some(stderr.to_string());
    }
    let stdout = output.stdout.trim();
    (!stdout.is_empty()).then(|| stdout.to_string())
}

pub(super) fn run_json<T: DeserializeOwned>(
    runner: &impl GhRunner,
    cwd: Option<&Path>,
    command: GhCommand,
) -> Result<T, String> {
    let output = runner.run(cwd, &command)?;
    if !output.status_success {
        return Err(format_gh_error(&output));
    }

    serde_json::from_str(output.stdout.trim()).map_err(|error| {
        format!(
            "GitHub CLI response could not be parsed: {}. Output: {}",
            error,
            output.stdout.trim()
        )
    })
}

pub(super) fn format_gh_error(output: &GhOutput) -> String {
    let details = non_empty_stderr(output)
        .unwrap_or_else(|| "GitHub CLI command failed without details.".to_string());
    format!("GitHub CLI request failed. {}", details)
}

pub(super) fn gh_api_paginated_with_runner<T: DeserializeOwned>(
    runner: &impl GhRunner,
    cwd: &Path,
    endpoint: &str,
) -> Result<Vec<T>, String> {
    let pages = run_json::<Vec<Vec<T>>>(
        runner,
        Some(cwd),
        GhCommand {
            args: vec![
                "api".to_string(),
                endpoint.to_string(),
                "--paginate".to_string(),
                "--slurp".to_string(),
            ],
            stdin: None,
        },
    )?;

    Ok(pages.into_iter().flatten().collect())
}

pub(super) fn gh_api_json<TPayload: Serialize, TResponse: DeserializeOwned>(
    cwd: &Path,
    method: &str,
    endpoint: &str,
    payload: &TPayload,
) -> Result<TResponse, String> {
    let stdin = serde_json::to_string(payload).map_err(|error| error.to_string())?;
    run_json::<TResponse>(
        &ProcessGhRunner,
        Some(cwd),
        GhCommand {
            args: vec![
                "api".to_string(),
                endpoint.to_string(),
                "--method".to_string(),
                method.to_string(),
                "--input".to_string(),
                "-".to_string(),
            ],
            stdin: Some(stdin),
        },
    )
}

pub(super) fn gh_api_get_with_runner<TResponse: DeserializeOwned>(
    runner: &impl GhRunner,
    cwd: &Path,
    endpoint: &str,
) -> Result<TResponse, String> {
    run_json::<TResponse>(
        runner,
        Some(cwd),
        GhCommand {
            args: vec!["api".to_string(), endpoint.to_string()],
            stdin: None,
        },
    )
}

pub(super) fn gh_graphql<TPayload: Serialize, TResponse: DeserializeOwned>(
    cwd: &Path,
    payload: &TPayload,
) -> Result<TResponse, String> {
    gh_graphql_with_runner(&ProcessGhRunner, cwd, payload)
}

pub(super) fn gh_graphql_with_runner<TPayload: Serialize, TResponse: DeserializeOwned>(
    runner: &impl GhRunner,
    cwd: &Path,
    payload: &TPayload,
) -> Result<TResponse, String> {
    let stdin = serde_json::to_string(payload).map_err(|error| error.to_string())?;
    run_json::<TResponse>(
        runner,
        Some(cwd),
        GhCommand {
            args: vec![
                "api".to_string(),
                "graphql".to_string(),
                "--input".to_string(),
                "-".to_string(),
            ],
            stdin: Some(stdin),
        },
    )
}
