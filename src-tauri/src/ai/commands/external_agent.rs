use super::super::types::{AnalysisEngine, LocalAiPreferences, LocalAiRunRequest};
use serde_json::json;
use std::collections::{BTreeMap, HashMap};

pub(super) fn external_agent_digest(
    agent_id: &str,
    version: Option<&str>,
    option_values: &HashMap<String, String>,
) -> String {
    let mut entries = option_values
        .iter()
        .map(|(config_id, value)| format!("{config_id}={value}"))
        .collect::<Vec<_>>();
    entries.sort();

    let version = version.unwrap_or("unknown-version");
    if entries.is_empty() {
        format!("external:{agent_id}:{version}")
    } else {
        format!("external:{agent_id}:{version}:{}", entries.join("|"))
    }
}

pub(super) fn selected_external_agent_id<'a>(
    request: &LocalAiRunRequest,
    preferences: &'a LocalAiPreferences,
) -> Option<&'a str> {
    let action_engine = preferences.action_engines.get(request.action_kind.as_key());
    let engine = match action_engine {
        Some(AnalysisEngine::LocalModel { model_id })
            if model_id
                .as_deref()
                .map(str::trim)
                .filter(|model_id| !model_id.is_empty())
                .is_none() =>
        {
            &preferences.analysis_engine
        }
        Some(engine) => engine,
        None => &preferences.analysis_engine,
    };
    match engine {
        AnalysisEngine::ExternalAgent { agent_id } => Some(agent_id.as_str()),
        AnalysisEngine::LocalModel { .. } => None,
    }
}

pub(super) fn external_agent_structured_output_error(
    request: &LocalAiRunRequest,
    agent_id: &str,
    agent_version: Option<&str>,
    transcript: &str,
    parse_error: &str,
    option_values: &HashMap<String, String>,
) -> String {
    let sorted_options = option_values
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<BTreeMap<_, _>>();
    let debug_payload = json!({
        "kind": "external_agent_structured_output_error",
        "message": "External agent completed, but Gitano could not parse the final output as the required structured JSON result.",
        "agentId": agent_id,
        "agentVersion": agent_version,
        "actionKind": request.action_kind.as_key(),
        "runId": request.run_id,
        "repoPath": request.repo_path,
        "commitSha": request.commit_sha,
        "baseRef": request.base_ref,
        "headRef": request.head_ref,
        "comparisonMode": request.comparison_mode,
        "parseError": parse_error,
        "transcript": transcript,
        "externalAgentOptionValues": sorted_options,
    });
    let debug_payload =
        serde_json::to_string_pretty(&debug_payload).unwrap_or_else(|_| debug_payload.to_string());

    format!(
        "External agent output could not be parsed. Report this debug payload:\n{}",
        debug_payload
    )
}

pub(super) fn external_agent_unstructured_output_error(
    request: &LocalAiRunRequest,
    agent_id: &str,
    agent_version: Option<&str>,
    transcript: &str,
    parse_error: &str,
    option_values: &HashMap<String, String>,
) -> String {
    match external_agent_transcript_error(transcript) {
        Some(agent_error) => external_agent_runtime_error(
            request,
            agent_id,
            agent_version,
            transcript,
            agent_error,
            parse_error,
            option_values,
        ),
        None if !transcript_contains_json_object(transcript) => {
            external_agent_missing_result_error(
                request,
                agent_id,
                agent_version,
                transcript,
                parse_error,
                option_values,
            )
        }
        None => external_agent_structured_output_error(
            request,
            agent_id,
            agent_version,
            transcript,
            parse_error,
            option_values,
        ),
    }
}

fn external_agent_runtime_error(
    request: &LocalAiRunRequest,
    agent_id: &str,
    agent_version: Option<&str>,
    transcript: &str,
    agent_error: &str,
    parse_error: &str,
    option_values: &HashMap<String, String>,
) -> String {
    let sorted_options = option_values
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<BTreeMap<_, _>>();
    let debug_payload = json!({
        "kind": "external_agent_runtime_error",
        "message": "External agent returned an error before producing Gitano's structured result.",
        "agentId": agent_id,
        "agentVersion": agent_version,
        "actionKind": request.action_kind.as_key(),
        "runId": request.run_id,
        "repoPath": request.repo_path,
        "commitSha": request.commit_sha,
        "baseRef": request.base_ref,
        "headRef": request.head_ref,
        "comparisonMode": request.comparison_mode,
        "agentError": agent_error,
        "parseError": parse_error,
        "transcript": transcript,
        "externalAgentOptionValues": sorted_options,
    });
    let debug_payload =
        serde_json::to_string_pretty(&debug_payload).unwrap_or_else(|_| debug_payload.to_string());

    format!(
        "External agent failed before returning a structured result:\n{}\n\nReport this debug payload:\n{}",
        agent_error, debug_payload
    )
}

fn external_agent_missing_result_error(
    request: &LocalAiRunRequest,
    agent_id: &str,
    agent_version: Option<&str>,
    transcript: &str,
    parse_error: &str,
    option_values: &HashMap<String, String>,
) -> String {
    let sorted_options = option_values
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<BTreeMap<_, _>>();
    let debug_payload = json!({
        "kind": "external_agent_missing_structured_result_error",
        "message": "External agent completed without returning Gitano's required structured result.",
        "agentId": agent_id,
        "agentVersion": agent_version,
        "actionKind": request.action_kind.as_key(),
        "runId": request.run_id,
        "repoPath": request.repo_path,
        "commitSha": request.commit_sha,
        "baseRef": request.base_ref,
        "headRef": request.head_ref,
        "comparisonMode": request.comparison_mode,
        "parseError": parse_error,
        "transcript": transcript,
        "externalAgentOptionValues": sorted_options,
    });
    let debug_payload =
        serde_json::to_string_pretty(&debug_payload).unwrap_or_else(|_| debug_payload.to_string());

    format!(
        "External agent completed without returning a structured result.\n\nReport this debug payload:\n{}",
        debug_payload
    )
}

fn external_agent_transcript_error(transcript: &str) -> Option<&str> {
    let trimmed = transcript.trim();
    if trimmed.is_empty() {
        return None;
    }

    let normalized = trimmed.to_lowercase();
    if normalized.starts_with("error:")
        || normalized.contains("not authorized")
        || normalized.contains("authentication required")
        || normalized.contains("permission denied")
        || normalized.contains("requires an enterprise or organization policy")
    {
        Some(trimmed)
    } else {
        None
    }
}

fn transcript_contains_json_object(transcript: &str) -> bool {
    transcript.contains('{')
}

#[cfg(test)]
mod tests {
    use super::super::super::types::LocalAiActionKind;
    use super::*;

    fn branch_request(action_kind: LocalAiActionKind) -> LocalAiRunRequest {
        LocalAiRunRequest {
            repo_path: "/repo".to_string(),
            action_kind,
            run_id: Some("run-1".to_string()),
            model_id: None,
            force_refresh: false,
            commit_sha: None,
            base_ref: Some("main".to_string()),
            head_ref: Some("feature".to_string()),
            comparison_mode: None,
            external_agent_option_overrides: HashMap::new(),
        }
    }

    #[test]
    fn selected_external_agent_id_prefers_action_engine() {
        let mut preferences = super::super::super::models::default_preferences();
        preferences.analysis_engine = AnalysisEngine::ExternalAgent {
            agent_id: "codex-acp".to_string(),
        };
        preferences.action_engines.insert(
            LocalAiActionKind::BranchAnalysis.as_key().to_string(),
            AnalysisEngine::ExternalAgent {
                agent_id: "gemini".to_string(),
            },
        );
        let request = branch_request(LocalAiActionKind::BranchAnalysis);

        assert_eq!(
            selected_external_agent_id(&request, &preferences),
            Some("gemini")
        );
    }

    #[test]
    fn selected_external_agent_id_uses_global_external_when_action_is_unset() {
        let mut preferences = super::super::super::models::default_preferences();
        preferences.analysis_engine = AnalysisEngine::ExternalAgent {
            agent_id: "codex-acp".to_string(),
        };
        preferences.action_engines.insert(
            LocalAiActionKind::BranchReview.as_key().to_string(),
            AnalysisEngine::LocalModel { model_id: None },
        );
        let request = branch_request(LocalAiActionKind::BranchReview);

        assert_eq!(
            selected_external_agent_id(&request, &preferences),
            Some("codex-acp")
        );
    }

    #[test]
    fn external_agent_structured_output_error_includes_debug_payload() {
        let request = LocalAiRunRequest {
            repo_path: "/repo".to_string(),
            action_kind: LocalAiActionKind::BranchAnalysis,
            run_id: Some("run-1".to_string()),
            model_id: None,
            force_refresh: false,
            commit_sha: None,
            base_ref: Some("main".to_string()),
            head_ref: Some("feature".to_string()),
            comparison_mode: Some("direct".to_string()),
            external_agent_option_overrides: HashMap::new(),
        };
        let mut options = HashMap::new();
        options.insert("model".to_string(), "copilot-sonnet".to_string());

        let error = external_agent_structured_output_error(
            &request,
            "github-copilot-cli",
            Some("1.0.51"),
            "SUMMARY\nInspecting directly.",
            "invalid JSON",
            &options,
        );

        assert!(error.contains("external_agent_structured_output_error"));
        assert!(error.contains("\"agentId\": \"github-copilot-cli\""));
        assert!(error.contains("\"actionKind\": \"branchAnalysis\""));
        assert!(error.contains("\"parseError\": \"invalid JSON\""));
        assert!(error.contains("SUMMARY\\nInspecting directly."));
        assert!(error.contains("\"model\": \"copilot-sonnet\""));
    }

    #[test]
    fn external_agent_unstructured_output_error_promotes_agent_errors() {
        let request = LocalAiRunRequest {
            repo_path: "/repo".to_string(),
            action_kind: LocalAiActionKind::CommitAnalysis,
            run_id: Some("run-1".to_string()),
            model_id: None,
            force_refresh: false,
            commit_sha: Some("48ef742".to_string()),
            base_ref: None,
            head_ref: None,
            comparison_mode: None,
            external_agent_option_overrides: HashMap::new(),
        };

        let error = external_agent_unstructured_output_error(
            &request,
            "github-copilot-cli",
            Some("1.0.51"),
            "Error: You are not authorized to use this Copilot feature, it requires an enterprise or organization policy to be enabled. (Request ID: E5F2)",
            "Local AI returned invalid JSON: expected value at line 1 column 1",
            &HashMap::new(),
        );

        assert!(error.contains("External agent failed before returning a structured result"));
        assert!(error.contains("external_agent_runtime_error"));
        assert!(error.contains("\"agentId\": \"github-copilot-cli\""));
        assert!(error.contains("\"actionKind\": \"commitAnalysis\""));
        assert!(error.contains("\"agentError\": \"Error: You are not authorized"));
        assert!(error.contains("\"parseError\": \"Local AI returned invalid JSON"));
    }

    #[test]
    fn external_agent_unstructured_output_error_promotes_missing_final_result() {
        let request = LocalAiRunRequest {
            repo_path: "/repo".to_string(),
            action_kind: LocalAiActionKind::CommitAnalysis,
            run_id: Some("run-1".to_string()),
            model_id: None,
            force_refresh: false,
            commit_sha: Some("48ef742".to_string()),
            base_ref: None,
            head_ref: None,
            comparison_mode: None,
            external_agent_option_overrides: HashMap::new(),
        };

        let error = external_agent_unstructured_output_error(
            &request,
            "github-copilot-cli",
            Some("1.0.51"),
            "Running git show to collect stat, file list, and unified diff (3-line context) for the commit so analysis is evidence-backed. Calling report_intent in parallel per workflow rules.",
            "Local AI returned invalid JSON: expected value at line 1 column 1",
            &HashMap::new(),
        );

        assert!(error.contains("External agent completed without returning a structured result"));
        assert!(error.contains("external_agent_missing_structured_result_error"));
        assert!(error.contains("\"agentId\": \"github-copilot-cli\""));
        assert!(error.contains("\"actionKind\": \"commitAnalysis\""));
        assert!(error.contains("Running git show to collect stat"));
        assert!(error.contains("\"parseError\": \"Local AI returned invalid JSON"));
    }
}
