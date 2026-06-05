use super::super::types::{
    LocalAiActionKind, LocalAiAnalysisResult, LocalAiBranchReviewFinding, LocalAiBranchReviewNote,
    LocalAiBranchReviewResult, LocalAiCommitMessageResult, LocalAiConflictCandidate,
    LocalAiConflictCandidateResult, LocalAiConflictFileSuggestion, LocalAiConflictScope,
    LocalAiConflictSuggestionsResult, LocalAiFinding, LocalAiFindingSeverity,
    LocalAiReviewConfidence, LocalAiReviewLineSide, LocalAiStructuredResult,
};
use crate::git::conflicts::types::GitConflictSignatures;
use serde_json::Value;

pub fn parse_structured_result(
    action_kind: LocalAiActionKind,
    response: &str,
) -> Result<LocalAiStructuredResult, String> {
    let initial_error = match serde_json::from_str::<Value>(response.trim()) {
        Ok(value) => return parse_structured_value(action_kind, &value),
        Err(error) if error.is_eof() => format!(
            "Local AI returned incomplete JSON, likely because the model output stopped before the response was finished: {}",
            error
        ),
        Err(error) => format!("Local AI returned invalid JSON: {}", error),
    };

    for candidate in json_object_candidates(response) {
        let Ok(value) = serde_json::from_str::<Value>(candidate) else {
            continue;
        };
        if !looks_like_structured_result(action_kind, &value) {
            continue;
        }

        if let Ok(result) = parse_structured_value(action_kind, &value) {
            return Ok(result);
        }
    }

    Err(initial_error)
}

fn parse_structured_value(
    action_kind: LocalAiActionKind,
    value: &Value,
) -> Result<LocalAiStructuredResult, String> {
    match action_kind {
        LocalAiActionKind::CommitMessage => Ok(LocalAiStructuredResult::CommitMessage(
            parse_commit_message(value)?,
        )),
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::BranchAnalysis => {
            Ok(LocalAiStructuredResult::Analysis(parse_analysis(value)))
        }
        LocalAiActionKind::BranchReview => Ok(LocalAiStructuredResult::BranchReview(
            parse_branch_review(value)?,
        )),
        LocalAiActionKind::MergeConflictSuggestions => {
            if looks_like_conflict_candidate(value) {
                Ok(LocalAiStructuredResult::ConflictCandidate(
                    parse_conflict_candidate(value)?,
                ))
            } else {
                Ok(LocalAiStructuredResult::ConflictSuggestions(parse_conflicts(
                    value,
                )))
            }
        }
    }
}

fn looks_like_structured_result(action_kind: LocalAiActionKind, value: &Value) -> bool {
    match action_kind {
        LocalAiActionKind::CommitMessage => {
            value.get("commitMessage").is_some_and(Value::is_object)
                || string_field(
                    value,
                    &["message", "commitMessage", "commit_message", "subject"],
                )
                .is_some()
        }
        LocalAiActionKind::CommitAnalysis | LocalAiActionKind::BranchAnalysis => {
            string_field(value, &["summary", "riskAssessment", "risk_assessment"]).is_some()
                || value.get("findings").is_some_and(Value::is_array)
                || value.get("changedAreas").is_some_and(Value::is_array)
                || value.get("changed_areas").is_some_and(Value::is_array)
                || value.get("behavioralChanges").is_some_and(Value::is_array)
                || value.get("behavioral_changes").is_some_and(Value::is_array)
        }
        LocalAiActionKind::BranchReview => {
            string_field(value, &["summary"]).is_some()
                || value.get("findings").is_some_and(Value::is_array)
                || value.get("notes").is_some_and(Value::is_array)
        }
        LocalAiActionKind::MergeConflictSuggestions => {
            string_field(value, &["summary"]).is_some()
                || value.get("files").is_some_and(Value::is_array)
                || looks_like_conflict_candidate(value)
        }
    }
}

fn json_object_candidates(response: &str) -> Vec<&str> {
    let mut candidates = Vec::new();
    let mut search_start = 0;

    while let Some(relative_start) = response[search_start..].find('{') {
        let start = search_start + relative_start;
        let Some(end) = json_object_end(response, start) else {
            search_start = start + 1;
            continue;
        };
        candidates.push(&response[start..=end]);
        search_start = end + 1;
    }

    candidates
}

fn json_object_end(response: &str, start: usize) -> Option<usize> {
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (offset, character) in response[start..].char_indices() {
        if in_string {
            if escaped {
                escaped = false;
                continue;
            }
            match character {
                '\\' => escaped = true,
                '"' => in_string = false,
                _ => {}
            }
            continue;
        }

        match character {
            '"' => in_string = true,
            '{' => depth += 1,
            '}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some(start + offset);
                }
            }
            _ => {}
        }
    }

    None
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

fn looks_like_conflict_candidate(value: &Value) -> bool {
    let candidate = value
        .get("candidate")
        .filter(|candidate| candidate.is_object())
        .unwrap_or(value);

    string_field(
        candidate,
        &["candidateKind", "candidate_kind", "kind"],
    )
    .is_some()
        || string_field(candidate, &["replacement", "content"]).is_some()
}

fn parse_conflict_candidate(value: &Value) -> Result<LocalAiConflictCandidateResult, String> {
    let candidate_value = value
        .get("candidate")
        .filter(|candidate| candidate.is_object())
        .unwrap_or(value);
    let scope = parse_conflict_scope(value);
    let file_path = scope.file_path().to_string();
    let summary = string_field(value, &["summary"])
        .or_else(|| string_field(candidate_value, &["summary"]))
        .unwrap_or_else(|| "AI conflict candidate".to_string());
    let signatures = parse_conflict_signatures(value);
    let candidate_kind = string_field(
        candidate_value,
        &["candidateKind", "candidate_kind", "kind"],
    )
    .unwrap_or_else(|| {
        if candidate_value.get("content").is_some() {
            "fullFileResult".to_string()
        } else {
            "regionReplacement".to_string()
        }
    });
    let candidate = match candidate_kind.as_str() {
        "fullFileResult" | "full_file_result" | "file" => {
            LocalAiConflictCandidate::FullFileResult {
                scope: scope.clone(),
                summary: summary.clone(),
                content: string_field(candidate_value, &["content"])
                    .ok_or_else(|| "Local AI did not return full-file content.".to_string())?,
                input_signatures: signatures,
            }
        }
        _ => LocalAiConflictCandidate::RegionReplacement {
            scope: scope.clone(),
            summary: summary.clone(),
            replacement: string_field(candidate_value, &["replacement", "content"])
                .ok_or_else(|| "Local AI did not return a region replacement.".to_string())?,
            input_signatures: signatures,
        },
    };

    Ok(LocalAiConflictCandidateResult {
        file_path,
        scope,
        summary,
        candidate,
    })
}

fn parse_conflict_scope(value: &Value) -> LocalAiConflictScope {
    let scope_value = value
        .get("scope")
        .filter(|scope| scope.is_object())
        .unwrap_or(value);
    let file_path = string_field(
        scope_value,
        &["filePath", "file_path", "targetFilePath", "target_file_path", "file"],
    )
    .or_else(|| string_field(value, &["filePath", "targetFilePath", "file"]))
    .unwrap_or_else(|| "unknown".to_string());
    let region_id = string_field(scope_value, &["regionId", "region_id"]);
    let kind = string_field(scope_value, &["kind", "scopeKind", "scope_kind"])
        .unwrap_or_else(|| {
            if region_id.is_some() {
                "region".to_string()
            } else {
                "file".to_string()
            }
        });

    if kind == "region" {
        LocalAiConflictScope::Region {
            file_path,
            region_id: region_id.unwrap_or_else(|| "unknown".to_string()),
        }
    } else {
        LocalAiConflictScope::File { file_path }
    }
}

fn parse_conflict_signatures(value: &Value) -> GitConflictSignatures {
    let signatures = value
        .get("inputSignatures")
        .or_else(|| value.get("input_signatures"))
        .unwrap_or(value);

    GitConflictSignatures {
        index_signature: string_field(
            signatures,
            &["indexSignature", "index_signature"],
        )
        .unwrap_or_default(),
        result_signature: string_field(
            signatures,
            &["resultSignature", "result_signature"],
        )
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
    fn extracts_branch_review_json_from_external_agent_transcript() {
        let result = parse_structured_result(
            LocalAiActionKind::BranchReview,
            r#"Context compacted {"summary":"One issue","findings":[{"severity":"high","confidence":"high","title":"Missing guard","explanation":"The new call can fail.","impact":"The UI can break.","recommendation":"Handle the error.","suggestedComment":"Please handle this error before updating state.","filePath":"src/app.ts","side":"new","line":42}],"notes":[]}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::BranchReview(review) => {
                assert_eq!(review.summary, "One issue");
                assert_eq!(review.findings.len(), 1);
                assert_eq!(review.findings[0].title, "Missing guard");
            }
            _ => panic!("expected branch review result"),
        }
    }

    #[test]
    fn parses_scoped_region_conflict_candidate() {
        let result = parse_structured_result(
            LocalAiActionKind::MergeConflictSuggestions,
            r#"{"summary":"Use the safer branch","candidateKind":"regionReplacement","replacement":"resolved();"}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::ConflictCandidate(candidate) => {
                assert_eq!(candidate.summary, "Use the safer branch");
                match candidate.candidate {
                    LocalAiConflictCandidate::RegionReplacement {
                        replacement, ..
                    } => {
                        assert_eq!(replacement, "resolved();");
                    }
                    _ => panic!("expected region replacement candidate"),
                }
            }
            _ => panic!("expected conflict candidate result"),
        }
    }

    #[test]
    fn rejects_scoped_conflict_candidate_without_content() {
        let error = parse_structured_result(
            LocalAiActionKind::MergeConflictSuggestions,
            r#"{"summary":"No candidate","candidateKind":"fullFileResult"}"#,
        )
        .expect_err("missing candidate content should fail");

        assert!(error.contains("full-file content"));
    }

    #[test]
    fn skips_tool_metadata_json_before_structured_result() {
        let result = parse_structured_result(
            LocalAiActionKind::BranchReview,
            r#"{"call_id":"call_1","aggregated_output":"debug payload"}
{"summary":"No actionable changed-code risks were found.","findings":[],"notes":[]}"#,
        )
        .unwrap();

        match result {
            LocalAiStructuredResult::BranchReview(review) => {
                assert_eq!(
                    review.summary,
                    "No actionable changed-code risks were found."
                );
                assert!(review.findings.is_empty());
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
