use super::git_context::LocalAiGitContext;
use super::types::{
    LocalAiActionKind, LocalAiAnalysisResult, LocalAiBranchReviewFinding, LocalAiBranchReviewNote,
    LocalAiBranchReviewResult, LocalAiCommitMessageResult, LocalAiConflictFileSuggestion,
    LocalAiConflictSuggestionsResult, LocalAiFinding, LocalAiFindingSeverity,
    LocalAiReviewConfidence, LocalAiReviewLineSide, LocalAiStructuredResult,
};
use serde_json::Value;

pub const PROMPT_VERSION: &str = "local-ai-v4";

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
        LocalAiActionKind::BranchReview => build_branch_review_prompt(context),
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
    if context.action_kind == LocalAiActionKind::BranchAnalysis {
        return build_branch_analysis_prompt(context);
    }

    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         Be specific, evidence-oriented, and concise. Do not claim certainty without file or line evidence.\n\
         {}\n\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"riskAssessment\":\"...\",\"changedAreas\":[\"...\"],\"findings\":[{{\"severity\":\"info|low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"filePath\":\"optional\",\"line\":123,\"suggestion\":\"optional\"}}]}}\n\n\
         Git context:\n{}",
        task, context.prompt_context
    )
}

fn build_branch_analysis_prompt(context: &LocalAiGitContext) -> String {
    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         Analyze this branch or PR-style diff as a reviewer preparing to approve or question a PR.\n\
         Focus on intent, real risks, behavioral changes, potential regressions, test gaps, recommendations, and action items.\n\
         Do not return a raw changed-file list; the UI already shows the changed files. Mention files only when they support a concrete risk or action item.\n\
         Do not create low-value findings. If there are no concrete findings, return an empty findings array and useful recommendations or action items if applicable.\n\
         Keep output compact: summary and riskAssessment must stay under 600 characters each. Return at most 6 items in each list and at most 6 findings. Keep every list item and finding field under 320 characters.\n\
         Always close the JSON object; do not include markdown fences or commentary outside JSON.\n\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"riskAssessment\":\"...\",\"behavioralChanges\":[\"...\"],\"potentialRegressions\":[\"...\"],\"testGaps\":[\"...\"],\"recommendations\":[\"...\"],\"actionItems\":[\"...\"],\"findings\":[{{\"severity\":\"info|low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"filePath\":\"optional\",\"line\":123,\"suggestion\":\"optional\"}}]}}\n\n\
         Git context:\n{}",
        context.prompt_context
    )
}

fn build_branch_review_prompt(context: &LocalAiGitContext) -> String {
    format!(
        "You are Gitano's local coding assistant. You run entirely locally and only analyze the Git context below.\n\
         Review this branch like PR review feedback. Find changed lines that may introduce bugs, regressions, unsafe assumptions, missing validation, missing tests, or maintainability issues.\n\
         Every inline finding must be anchored to a changed line from the diff. Use side \"new\" for added/modified new-code feedback and side \"old\" only when the deleted line itself needs attention.\n\
         Do not summarize files. Do not produce informational cleanup comments. If there are no actionable changed-code risks, return an empty findings array and a concise summary.\n\
         Suggested comments should be ready to paste into a PR and should ask for a concrete change or clarification.\n\
         Keep output compact: return at most 6 findings and at most 3 notes. Keep every text field under 280 characters, except suggestedComment which must stay under 420 characters.\n\
         Prefer fewer high-confidence findings over a long list. Do not return an empty object; summary is required even when findings is empty. Always close the JSON object; do not include markdown fences or commentary outside JSON.\n\n\
         Return only JSON with this shape: {{\"summary\":\"...\",\"findings\":[{{\"severity\":\"low|medium|high\",\"confidence\":\"low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"impact\":\"...\",\"recommendation\":\"...\",\"suggestedComment\":\"...\",\"filePath\":\"path/to/file\",\"side\":\"old|new\",\"line\":123,\"endLine\":124}}],\"notes\":[{{\"severity\":\"low|medium|high\",\"confidence\":\"low|medium|high\",\"title\":\"...\",\"explanation\":\"...\",\"recommendation\":\"...\",\"suggestedComment\":\"optional\",\"filePath\":\"optional\"}}]}}\n\n\
         Git context:\n{}",
        context.prompt_context
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
    let value: Value = serde_json::from_str(response).map_err(|e| {
        if e.is_eof() {
            format!(
                "Local AI returned incomplete JSON, likely because the model output stopped before the response was finished: {}",
                e
            )
        } else {
            format!("Local AI returned invalid JSON: {}", e)
        }
    })?;

    match action_kind {
        LocalAiActionKind::CommitMessage => Ok(LocalAiStructuredResult::CommitMessage(
            parse_commit_message(&value)?,
        )),
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::BranchAnalysis => {
            Ok(LocalAiStructuredResult::Analysis(parse_analysis(&value)))
        }
        LocalAiActionKind::BranchReview => Ok(LocalAiStructuredResult::BranchReview(
            parse_branch_review(&value)?,
        )),
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
        behavioral_changes: string_array_field(value, "behavioralChanges")
            .into_iter()
            .chain(string_array_field(value, "behavioral_changes"))
            .collect(),
        potential_regressions: string_array_field(value, "potentialRegressions")
            .into_iter()
            .chain(string_array_field(value, "potential_regressions"))
            .collect(),
        test_gaps: string_array_field(value, "testGaps")
            .into_iter()
            .chain(string_array_field(value, "test_gaps"))
            .collect(),
        recommendations: string_array_field(value, "recommendations"),
        action_items: string_array_field(value, "actionItems")
            .into_iter()
            .chain(string_array_field(value, "action_items"))
            .collect(),
        findings: value
            .get("findings")
            .and_then(Value::as_array)
            .map(|items| items.iter().map(parse_finding).collect())
            .unwrap_or_default(),
    }
}

fn parse_branch_review(value: &Value) -> Result<LocalAiBranchReviewResult, String> {
    let summary = string_field(value, &["summary"]);
    let mut findings = Vec::new();
    let mut notes = Vec::new();

    if let Some(items) = value.get("findings").and_then(Value::as_array) {
        for item in items {
            match parse_branch_review_item(item) {
                Some(ParsedBranchReviewItem::Finding(finding)) => findings.push(finding),
                Some(ParsedBranchReviewItem::Note(note)) => notes.push(note),
                None => {}
            }
        }
    }

    if let Some(items) = value.get("notes").and_then(Value::as_array) {
        notes.extend(items.iter().filter_map(parse_branch_review_note));
    }

    if summary.is_none() && findings.is_empty() && notes.is_empty() {
        return Err(
            "Local AI returned unusable branch review output: no summary, findings, or notes were returned."
                .to_string(),
        );
    }

    Ok(LocalAiBranchReviewResult {
        summary: summary
            .unwrap_or_else(|| "Branch review returned unanchored feedback.".to_string()),
        findings,
        notes,
    })
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

enum ParsedBranchReviewItem {
    Finding(LocalAiBranchReviewFinding),
    Note(LocalAiBranchReviewNote),
}

fn parse_branch_review_item(value: &Value) -> Option<ParsedBranchReviewItem> {
    let severity = parse_severity(
        string_field(value, &["severity"])
            .unwrap_or_else(|| "low".to_string())
            .as_str(),
    );
    let confidence = parse_confidence(
        string_field(value, &["confidence"])
            .unwrap_or_else(|| "medium".to_string())
            .as_str(),
    );
    let title = string_field(value, &["title"]);
    let explanation = string_field(value, &["explanation", "body"]);
    let impact = string_field(value, &["impact"]);
    let recommendation = string_field(value, &["recommendation", "suggestion"]);
    let suggested_comment = string_field(value, &["suggestedComment", "suggested_comment"]);
    let file_path = string_field(value, &["filePath", "file_path", "file"]);
    let line = usize_field(value, &["line"]);

    if !has_branch_review_text(
        title.as_deref(),
        explanation.as_deref(),
        impact.as_deref(),
        recommendation.as_deref(),
        suggested_comment.as_deref(),
    ) {
        return None;
    }

    if let (Some(file_path), Some(line)) = (file_path.clone(), line) {
        return Some(ParsedBranchReviewItem::Finding(
            LocalAiBranchReviewFinding {
                severity,
                confidence,
                title: title.unwrap_or_else(|| "AI review finding".to_string()),
                explanation: explanation.clone().unwrap_or_default(),
                impact: impact.unwrap_or_default(),
                recommendation: recommendation.clone().unwrap_or_default(),
                suggested_comment: suggested_comment
                    .clone()
                    .or_else(|| recommendation.clone())
                    .or_else(|| explanation.clone())
                    .unwrap_or_default(),
                file_path,
                side: parse_review_side(
                    string_field(value, &["side"])
                        .unwrap_or_else(|| "new".to_string())
                        .as_str(),
                ),
                line,
                end_line: usize_field(value, &["endLine", "end_line"]),
            },
        ));
    }

    Some(ParsedBranchReviewItem::Note(LocalAiBranchReviewNote {
        severity,
        confidence,
        title: title.unwrap_or_else(|| "AI review note".to_string()),
        explanation: explanation
            .or_else(|| impact.clone())
            .unwrap_or_else(|| "No explanation returned.".to_string()),
        recommendation: recommendation.unwrap_or_default(),
        suggested_comment,
        file_path,
    }))
}

fn parse_branch_review_note(value: &Value) -> Option<LocalAiBranchReviewNote> {
    match parse_branch_review_item(value) {
        Some(ParsedBranchReviewItem::Finding(finding)) => {
            let suggested_comment = if finding.suggested_comment.trim().is_empty() {
                None
            } else {
                Some(finding.suggested_comment)
            };

            Some(LocalAiBranchReviewNote {
                severity: finding.severity,
                confidence: finding.confidence,
                title: finding.title,
                explanation: finding.explanation,
                recommendation: finding.recommendation,
                suggested_comment,
                file_path: Some(finding.file_path),
            })
        }
        Some(ParsedBranchReviewItem::Note(note)) => Some(note),
        None => None,
    }
}

fn has_branch_review_text(
    title: Option<&str>,
    explanation: Option<&str>,
    impact: Option<&str>,
    recommendation: Option<&str>,
    suggested_comment: Option<&str>,
) -> bool {
    [
        title,
        explanation,
        impact,
        recommendation,
        suggested_comment,
    ]
    .into_iter()
    .flatten()
    .any(|field| !field.trim().is_empty())
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
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn usize_field(value: &Value, names: &[&str]) -> Option<usize> {
    names.iter().find_map(|name| {
        let value = value.get(name)?;
        let parsed = value
            .as_u64()
            .or_else(|| value.as_str()?.trim().parse::<u64>().ok())?;
        usize::try_from(parsed).ok().filter(|line| *line > 0)
    })
}

fn string_array_field(value: &Value, name: &str) -> Vec<String> {
    value
        .get(name)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|item| !item.is_empty())
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

fn parse_confidence(value: &str) -> LocalAiReviewConfidence {
    match value.to_lowercase().as_str() {
        "high" => LocalAiReviewConfidence::High,
        "low" => LocalAiReviewConfidence::Low,
        _ => LocalAiReviewConfidence::Medium,
    }
}

fn parse_review_side(value: &str) -> LocalAiReviewLineSide {
    match value.to_lowercase().as_str() {
        "old" | "left" | "del" | "delete" | "deleted" => LocalAiReviewLineSide::Old,
        _ => LocalAiReviewLineSide::New,
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

    #[test]
    fn parses_branch_analysis_report_fields() {
        let result = parse_structured_result(
            LocalAiActionKind::BranchAnalysis,
            r#"{"summary":"Adds review AI","riskAssessment":"medium","behavioralChanges":["Adds a review action"],"potentialRegressions":["Review findings could be stale"],"testGaps":["No stale state test"],"recommendations":["Validate anchors"],"actionItems":["Add frontend coverage"],"findings":[]}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::Analysis(analysis) => {
                assert_eq!(analysis.behavioral_changes[0], "Adds a review action");
                assert_eq!(analysis.action_items[0], "Add frontend coverage");
            }
            _ => panic!("expected branch analysis result"),
        }
    }

    #[test]
    fn parses_branch_review_findings_and_converts_unanchored_inline_items_to_notes() {
        let result = parse_structured_result(
            LocalAiActionKind::BranchReview,
            r#"{"summary":"One issue","findings":[{"severity":"high","confidence":"medium","title":"Missing guard","explanation":"The new call can fail.","impact":"The UI may show stale data.","recommendation":"Handle the error path.","suggestedComment":"Can we handle this error before updating state?","filePath":"src/app.ts","side":"new","line":42},{"severity":"medium","title":"No anchor","explanation":"Missing path"}],"notes":[{"severity":"low","confidence":"low","title":"General test gap","explanation":"No broad test.","recommendation":"Add one."}]}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::BranchReview(review) => {
                assert_eq!(review.findings.len(), 1);
                assert_eq!(review.findings[0].file_path, "src/app.ts");
                assert_eq!(review.notes.len(), 2);
                assert_eq!(review.notes[0].title, "No anchor");
            }
            _ => panic!("expected branch review result"),
        }
    }

    #[test]
    fn rejects_empty_branch_review_json() {
        let error = parse_structured_result(LocalAiActionKind::BranchReview, r#"{}"#)
            .expect_err("empty branch review output should fail");

        assert!(error.contains("unusable branch review output"));
    }

    #[test]
    fn rejects_blank_summary_and_empty_branch_review_content() {
        let error = parse_structured_result(
            LocalAiActionKind::BranchReview,
            r#"{"summary":"   ","findings":[],"notes":[]}"#,
        )
        .expect_err("blank no-content branch review output should fail");

        assert!(error.contains("no summary, findings, or notes"));
    }

    #[test]
    fn preserves_genuine_no_finding_branch_review_summary() {
        let result = parse_structured_result(
            LocalAiActionKind::BranchReview,
            r#"{"summary":"No actionable changed-code risks were found.","findings":[],"notes":[]}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::BranchReview(review) => {
                assert_eq!(
                    review.summary,
                    "No actionable changed-code risks were found."
                );
                assert!(review.findings.is_empty());
                assert!(review.notes.is_empty());
            }
            _ => panic!("expected branch review result"),
        }
    }

    #[test]
    fn converts_useful_malformed_branch_review_finding_to_note() {
        let result = parse_structured_result(
            LocalAiActionKind::BranchReview,
            r#"{"summary":"One unanchored issue","findings":[{"severity":"high","confidence":"high","title":"Validate input","explanation":"The new path trusts user input.","recommendation":"Validate before saving.","filePath":"src/app.ts"}],"notes":[]}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::BranchReview(review) => {
                assert!(review.findings.is_empty());
                assert_eq!(review.notes.len(), 1);
                assert_eq!(review.notes[0].title, "Validate input");
                assert_eq!(review.notes[0].file_path.as_deref(), Some("src/app.ts"));
            }
            _ => panic!("expected branch review result"),
        }
    }

    #[test]
    fn describes_incomplete_json_as_incomplete_output() {
        let error = parse_structured_result(
            LocalAiActionKind::BranchReview,
            r#"{"summary":"cut off","findings":[{"title":"unfinished"#,
        )
        .expect_err("incomplete JSON should fail");

        assert!(error.contains("incomplete JSON"));
        assert!(error.contains("model output stopped"));
    }
}
