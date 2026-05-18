use super::git_context::LocalAiGitContext;
use super::types::{
    LocalAiActionKind, LocalAiAnalysisResult, LocalAiCommitMessageResult,
    LocalAiConflictFileSuggestion, LocalAiConflictSuggestionsResult, LocalAiFinding,
    LocalAiFindingSeverity, LocalAiStructuredResult,
};
use serde_json::Value;

pub const PROMPT_VERSION: &str = "local-ai-v2";

pub fn build_prompt(context: &LocalAiGitContext) -> String {
    match context.action_kind {
        LocalAiActionKind::CommitMessage => build_commit_message_prompt(context),
        LocalAiActionKind::CommitAnalysis => build_analysis_prompt(
            "Analyze this commit for correctness, risk, and maintainability.",
            context,
        ),
        LocalAiActionKind::BranchAnalysis => build_analysis_prompt(
            "Analyze this branch or PR-style diff for correctness, risk, and maintainability.",
            context,
        ),
        LocalAiActionKind::MergeConflictSuggestions => build_conflict_prompt(context),
    }
}

fn build_commit_message_prompt(context: &LocalAiGitContext) -> String {
    format!(
        "You are Gitano's local coding assistant. Generate a Git commit message for the staged changes only.\n\
         Return only compact JSON with this shape: {{\"message\":\"...\",\"alternatives\":[\"...\"]}}\n\
         Requirements:\n\
         - The message must be specific to the files and behavior changed.\n\
         - Use imperative mood and keep the subject near 72 characters.\n\
         - Prefer conventional commit style when a clear type fits: feat, fix, refactor, test, docs, chore.\n\
         - Do not use generic messages like \"Update changes\", \"Update files\", \"Misc changes\", or \"Refactor code\".\n\
         - Provide two concise alternatives.\n\n\
         Staged Git context:\n{}",
        context.prompt_context
    )
}

fn build_analysis_prompt(task: &str, context: &LocalAiGitContext) -> String {
    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         Be specific, evidence-oriented, and concise. Do not claim certainty without file or line evidence.\n\
         {}\n\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"riskAssessment\":\"...\",\"changedAreas\":[\"...\"],\"findings\":[{{\"severity\":\"info|low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"filePath\":\"optional\",\"line\":123,\"suggestion\":\"optional\"}}]}}\n\n\
         Git context:\n{}",
        task, context.prompt_context
    )
}

fn build_conflict_prompt(context: &LocalAiGitContext) -> String {
    format!(
        "You are Gitano's local coding assistant. Suggest how to resolve these merge conflicts.\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"files\":[{{\"filePath\":\"...\",\"summary\":\"...\",\"suggestion\":\"...\"}}]}}\n\
         Do not provide an auto-applied patch.\n\n\
         Git context:\n{}",
        context.prompt_context
    )
}

pub fn parse_structured_result(
    action_kind: LocalAiActionKind,
    response: &str,
) -> Result<LocalAiStructuredResult, String> {
    let value: Value = serde_json::from_str(response)
        .map_err(|e| format!("Local AI returned invalid JSON: {}", e))?;

    match action_kind {
        LocalAiActionKind::CommitMessage => Ok(LocalAiStructuredResult::CommitMessage(
            parse_commit_message(&value)?,
        )),
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::BranchAnalysis => {
            Ok(LocalAiStructuredResult::Analysis(parse_analysis(&value)))
        }
        LocalAiActionKind::MergeConflictSuggestions => Ok(
            LocalAiStructuredResult::ConflictSuggestions(parse_conflicts(&value)),
        ),
    }
}

fn parse_commit_message(value: &Value) -> Result<LocalAiCommitMessageResult, String> {
    let source = value
        .get("commitMessage")
        .filter(|nested| nested.is_object())
        .unwrap_or(value);
    let alternatives: Vec<String> = string_array_field(source, "alternatives")
        .into_iter()
        .map(|message| clean_commit_message(&message))
        .filter(|message| !message.is_empty() && !is_generic_commit_message(message))
        .collect();
    let message = string_field(
        source,
        &["message", "commitMessage", "commit_message", "subject"],
    )
    .map(|message| clean_commit_message(&message))
    .filter(|message| !message.is_empty())
    .or_else(|| alternatives.first().cloned())
    .ok_or_else(|| "Local AI did not return a commit message.".to_string())?;

    if is_generic_commit_message(&message) {
        return Err(format!(
            "Local AI returned a generic commit message: \"{}\".",
            message
        ));
    }

    Ok(LocalAiCommitMessageResult {
        message,
        alternatives,
    })
}

fn clean_commit_message(message: &str) -> String {
    message
        .trim()
        .trim_matches('"')
        .trim()
        .trim_end_matches('.')
        .to_string()
}

fn is_generic_commit_message(message: &str) -> bool {
    let normalized = message
        .trim()
        .trim_end_matches('.')
        .to_lowercase()
        .replace(['-', '_'], " ");
    matches!(
        normalized.as_str(),
        "change"
            | "changes"
            | "update"
            | "updates"
            | "update change"
            | "update changes"
            | "update code"
            | "update files"
            | "update project"
            | "misc changes"
            | "miscellaneous changes"
            | "refactor code"
            | "modify files"
    )
}

fn parse_analysis(value: &Value) -> LocalAiAnalysisResult {
    LocalAiAnalysisResult {
        summary: string_field(value, &["summary"]).unwrap_or_else(|| "No summary returned.".into()),
        risk_assessment: string_field(value, &["riskAssessment", "risk_assessment"]),
        changed_areas: string_array_field(value, "changedAreas")
            .into_iter()
            .chain(string_array_field(value, "changed_areas"))
            .collect(),
        findings: value
            .get("findings")
            .and_then(Value::as_array)
            .map(|items| items.iter().map(parse_finding).collect())
            .unwrap_or_default(),
    }
}

fn parse_conflicts(value: &Value) -> LocalAiConflictSuggestionsResult {
    LocalAiConflictSuggestionsResult {
        summary: string_field(value, &["summary"]).unwrap_or_else(|| "No summary returned.".into()),
        files: value
            .get("files")
            .and_then(Value::as_array)
            .map(|items| items.iter().map(parse_conflict_file).collect())
            .unwrap_or_default(),
    }
}

fn parse_finding(value: &Value) -> LocalAiFinding {
    LocalAiFinding {
        severity: parse_severity(
            string_field(value, &["severity"])
                .unwrap_or_else(|| "info".to_string())
                .as_str(),
        ),
        title: string_field(value, &["title"]).unwrap_or_else(|| "AI finding".to_string()),
        explanation: string_field(value, &["explanation", "body"])
            .unwrap_or_else(|| "No explanation returned.".to_string()),
        file_path: string_field(value, &["filePath", "file_path", "file"]),
        line: value
            .get("line")
            .and_then(Value::as_u64)
            .map(|line| line as usize),
        suggestion: string_field(value, &["suggestion"]),
    }
}

fn parse_conflict_file(value: &Value) -> LocalAiConflictFileSuggestion {
    LocalAiConflictFileSuggestion {
        file_path: string_field(value, &["filePath", "file_path", "file"])
            .unwrap_or_else(|| "unknown".to_string()),
        summary: string_field(value, &["summary"]).unwrap_or_else(|| "Conflict suggestion".into()),
        suggestion: string_field(value, &["suggestion"]).unwrap_or_default(),
    }
}

fn string_field(value: &Value, names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| value.get(name).and_then(Value::as_str))
        .map(ToString::to_string)
}

fn string_array_field(value: &Value, name: &str) -> Vec<String> {
    value
        .get(name)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn parse_severity(value: &str) -> LocalAiFindingSeverity {
    match value.to_lowercase().as_str() {
        "high" => LocalAiFindingSeverity::High,
        "medium" => LocalAiFindingSeverity::Medium,
        "low" => LocalAiFindingSeverity::Low,
        _ => LocalAiFindingSeverity::Info,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_commit_message_json() {
        let result = parse_structured_result(
            LocalAiActionKind::CommitMessage,
            r#"{"message":"Add local AI","alternatives":["Introduce local AI"]}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::CommitMessage(message) => {
                assert_eq!(message.message, "Add local AI");
                assert_eq!(message.alternatives.len(), 1);
            }
            _ => panic!("expected commit message result"),
        }
    }

    #[test]
    fn rejects_generic_commit_messages() {
        let error = parse_structured_result(
            LocalAiActionKind::CommitMessage,
            r#"{"message":"Update changes","alternatives":[]}"#,
        )
        .expect_err("generic message should fail");

        assert!(error.contains("generic commit message"));
    }

    #[test]
    fn parses_nested_commit_message_json() {
        let result = parse_structured_result(
            LocalAiActionKind::CommitMessage,
            r#"{"commitMessage":{"message":"fix: handle local setup completion","alternatives":[]}}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::CommitMessage(message) => {
                assert_eq!(message.message, "fix: handle local setup completion");
            }
            _ => panic!("expected commit message result"),
        }
    }

    #[test]
    fn parses_analysis_findings() {
        let result = parse_structured_result(
            LocalAiActionKind::CommitAnalysis,
            r#"{"summary":"Looks good","riskAssessment":"low","changedAreas":["backend"],"findings":[{"severity":"medium","title":"Check cache","explanation":"Cache may be stale","filePath":"src/cache.rs","line":12}]}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::Analysis(analysis) => {
                assert_eq!(
                    analysis.findings[0].severity,
                    LocalAiFindingSeverity::Medium
                );
                assert_eq!(
                    analysis.findings[0].file_path.as_deref(),
                    Some("src/cache.rs")
                );
            }
            _ => panic!("expected analysis result"),
        }
    }
}
