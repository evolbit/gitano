mod actions;
mod external_agents;
mod models;
mod preferences;
mod results;

pub use actions::*;
pub use external_agents::*;
pub use models::*;
pub use preferences::*;
pub use results::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_action_kind_as_camel_case() {
        let value = serde_json::to_value(LocalAiActionKind::CommitMessage).unwrap();

        assert_eq!(value, serde_json::json!("commitMessage"));
    }

    #[test]
    fn serializes_run_progress_as_camel_case() {
        let progress = LocalAiRunProgress {
            run_id: "run-1".to_string(),
            action_kind: LocalAiActionKind::BranchReview,
            state: LocalAiRunProgressState::RunningModel,
            message: "Running local model".to_string(),
            error: None,
        };

        let value = serde_json::to_value(progress).unwrap();

        assert_eq!(
            value,
            serde_json::json!({
                "runId": "run-1",
                "actionKind": "branchReview",
                "state": "runningModel",
                "message": "Running local model",
                "error": null
            })
        );
    }

    #[test]
    fn serializes_structured_result_as_tagged_camel_case() {
        let result = LocalAiStructuredResult::CommitMessage(LocalAiCommitMessageResult {
            message: "Add local AI".to_string(),
            alternatives: vec![],
        });

        let value = serde_json::to_value(result).unwrap();

        assert_eq!(
            value,
            serde_json::json!({
                "kind": "commitMessage",
                "data": {
                    "message": "Add local AI",
                    "alternatives": []
                }
            })
        );
    }

    #[test]
    fn deserializes_conflict_scope_request_as_camel_case() {
        let request: LocalAiRunRequest = serde_json::from_value(serde_json::json!({
            "repoPath": "/repo",
            "actionKind": "mergeConflictSuggestions",
            "conflictScope": {
                "kind": "file",
                "filePath": "src/conflict.ts"
            }
        }))
        .expect("deserialize request");

        assert_eq!(request.repo_path, "/repo");
        assert_eq!(
            request.action_kind,
            LocalAiActionKind::MergeConflictSuggestions
        );
        assert_eq!(
            request.conflict_scope,
            Some(LocalAiConflictScope::File {
                file_path: "src/conflict.ts".to_string()
            })
        );
    }

    #[test]
    fn deserializes_null_model_preference_as_clear_request() {
        let request: LocalAiSetModelPreferenceRequest = serde_json::from_value(serde_json::json!({
            "modelId": null,
            "actionKind": "commitMessage"
        }))
        .expect("deserialize request");

        assert_eq!(request.model_id, None);
        assert_eq!(request.action_kind, Some(LocalAiActionKind::CommitMessage));
    }

    #[test]
    fn deserializes_old_preferences_with_warm_defaults() {
        let preferences: LocalAiPreferences = serde_json::from_value(serde_json::json!({
            "globalModelId": "phi4-mini",
            "actionModelIds": {}
        }))
        .expect("deserialize old preferences");

        assert_eq!(
            preferences.analysis_engine.local_model_id(),
            Some("phi4-mini")
        );
        assert!(preferences.warm_model_ids.is_empty());
        assert_eq!(preferences.keep_alive_minutes, DEFAULT_KEEP_ALIVE_MINUTES);
    }

    #[test]
    fn deserializes_old_action_preferences_as_local_engines() {
        let preferences: LocalAiPreferences = serde_json::from_value(serde_json::json!({
            "globalModelId": "phi4-mini",
            "actionModelIds": {
                "branchAnalysis": "qwen2.5-coder:7b"
            }
        }))
        .expect("deserialize old preferences");

        assert_eq!(
            preferences
                .action_engines
                .get("branchAnalysis")
                .and_then(AnalysisEngine::local_model_id),
            Some("qwen2.5-coder:7b")
        );
    }

    #[test]
    fn deserializes_external_engine_with_empty_warm_preferences() {
        let preferences: LocalAiPreferences = serde_json::from_value(serde_json::json!({
            "analysisEngine": {
                "type": "external_agent",
                "agentId": "codex-acp"
            },
            "warmModelIds": ["phi4-mini"]
        }))
        .expect("deserialize external preferences");

        assert!(preferences.analysis_engine.is_external_agent());
        assert!(preferences.warm_model_ids.is_empty());
    }
}
