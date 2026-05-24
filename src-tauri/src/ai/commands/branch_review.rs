use super::super::types::{
    LocalAiBranchReviewNote, LocalAiBranchReviewResult, LocalAiFindingSeverity,
    LocalAiReviewConfidence, LocalAiReviewLineSide,
};
use std::collections::HashSet;

pub(super) const BRANCH_REVIEW_PARALLEL_CALLS: usize = 5;

pub(super) fn merge_branch_review_blocks(
    reviews: Vec<(String, LocalAiBranchReviewResult)>,
    failures: Vec<String>,
    total_blocks: usize,
) -> LocalAiBranchReviewResult {
    let mut findings = Vec::new();
    let mut notes = Vec::new();
    let mut finding_keys = HashSet::new();
    let mut note_keys = HashSet::new();

    for (_file_path, review) in reviews {
        for finding in review.findings {
            let side = match finding.side {
                LocalAiReviewLineSide::Old => "old",
                LocalAiReviewLineSide::New => "new",
            };
            let key = format!(
                "{}:{}:{}:{}",
                finding.file_path, side, finding.line, finding.title
            );
            if finding_keys.insert(key) {
                findings.push(finding);
            }
        }

        for note in review.notes {
            let key = format!(
                "{}:{}:{}",
                note.file_path.as_deref().unwrap_or_default(),
                note.title,
                note.explanation
            );
            if note_keys.insert(key) {
                notes.push(note);
            }
        }
    }

    if total_blocks > 1 {
        notes.push(LocalAiBranchReviewNote {
            severity: LocalAiFindingSeverity::Low,
            confidence: LocalAiReviewConfidence::Medium,
            title: "Segmented review".to_string(),
            explanation: format!(
                "Reviewed {} file blocks independently with up to {} local model calls in parallel.",
                total_blocks, BRANCH_REVIEW_PARALLEL_CALLS
            ),
            recommendation:
                "Review cross-file behavior manually when related changes span multiple files."
                    .to_string(),
            suggested_comment: None,
            file_path: None,
        });
    }

    for failure in failures {
        notes.push(LocalAiBranchReviewNote {
            severity: LocalAiFindingSeverity::Medium,
            confidence: LocalAiReviewConfidence::Medium,
            title: "Review block failed".to_string(),
            explanation: failure,
            recommendation: "Retry the branch review or inspect the affected file manually."
                .to_string(),
            suggested_comment: None,
            file_path: None,
        });
    }

    let summary = if findings.is_empty() {
        format!(
            "No actionable changed-code risks were found across {} reviewed file block{}.",
            total_blocks,
            if total_blocks == 1 { "" } else { "s" }
        )
    } else {
        format!(
            "Reviewed {} file block{} and returned {} actionable finding{}.",
            total_blocks,
            if total_blocks == 1 { "" } else { "s" },
            findings.len(),
            if findings.len() == 1 { "" } else { "s" }
        )
    };

    LocalAiBranchReviewResult {
        summary,
        findings,
        notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_branch_review_blocks_adds_segmented_review_note() {
        let review = LocalAiBranchReviewResult {
            summary: "One issue".to_string(),
            findings: vec![],
            notes: vec![],
        };

        let merged = merge_branch_review_blocks(vec![("a.txt".to_string(), review)], vec![], 2);

        assert!(merged
            .notes
            .iter()
            .any(|note| note.title == "Segmented review"));
        assert!(merged.summary.contains("2 reviewed file blocks"));
    }
}
