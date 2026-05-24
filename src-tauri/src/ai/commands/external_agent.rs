use super::super::types::{
    AnalysisEngine, LocalAiActionKind, LocalAiAnalysisResult, LocalAiBranchReviewNote,
    LocalAiBranchReviewResult, LocalAiCommitMessageResult, LocalAiConflictSuggestionsResult,
    LocalAiFindingSeverity, LocalAiPreferences, LocalAiReviewConfidence, LocalAiRunRequest,
    LocalAiStructuredResult,
};
use std::collections::HashMap;

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

pub(super) fn external_unstructured_result(
    action_kind: LocalAiActionKind,
    transcript: &str,
    parse_error: &str,
) -> LocalAiStructuredResult {
    let summary = if transcript.trim().is_empty() {
        format!(
            "External agent completed, but Gitano could not parse structured output: {}",
            parse_error
        )
    } else {
        transcript.trim().to_string()
    };
    let note = format!(
        "Gitano could not parse the external agent output as structured JSON: {}",
        parse_error
    );

    match action_kind {
        LocalAiActionKind::BranchReview => {
            LocalAiStructuredResult::BranchReview(LocalAiBranchReviewResult {
                summary,
                findings: Vec::new(),
                notes: vec![LocalAiBranchReviewNote {
                    severity: LocalAiFindingSeverity::Medium,
                    confidence: LocalAiReviewConfidence::Medium,
                    title: "Unstructured external agent output".to_string(),
                    explanation: note,
                    recommendation:
                        "Review the external agent transcript before treating this as complete."
                            .to_string(),
                    suggested_comment: None,
                    file_path: None,
                }],
            })
        }
        LocalAiActionKind::MergeConflictSuggestions => {
            LocalAiStructuredResult::ConflictSuggestions(LocalAiConflictSuggestionsResult {
                summary,
                files: Vec::new(),
            })
        }
        LocalAiActionKind::CommitMessage => {
            LocalAiStructuredResult::CommitMessage(LocalAiCommitMessageResult {
                message: summary,
                alternatives: Vec::new(),
            })
        }
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::BranchAnalysis => {
            LocalAiStructuredResult::Analysis(LocalAiAnalysisResult {
                summary,
                risk_assessment: Some(note),
                changed_areas: Vec::new(),
                behavioral_changes: Vec::new(),
                potential_regressions: Vec::new(),
                test_gaps: Vec::new(),
                recommendations: Vec::new(),
                action_items: Vec::new(),
                findings: Vec::new(),
            })
        }
    }
}

#[cfg(test)]
mod tests {
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
    fn external_unstructured_branch_analysis_keeps_transcript() {
        let result = external_unstructured_result(
            LocalAiActionKind::BranchAnalysis,
            "External summary",
            "invalid JSON",
        );

        match result {
            LocalAiStructuredResult::Analysis(analysis) => {
                assert_eq!(analysis.summary, "External summary");
                assert!(analysis
                    .risk_assessment
                    .as_deref()
                    .unwrap_or_default()
                    .contains("invalid JSON"));
            }
            _ => panic!("expected analysis fallback"),
        }
    }
}
