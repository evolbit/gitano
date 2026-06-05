use super::types::{
    ConflictStageEntry, GitConflictContentRange, GitConflictFileDetail, GitConflictRegion,
    GitConflictSide, GitConflictSignatures,
};
use super::{
    conflict_kinds, entries_by_path, index_signature, load_result_version, load_stage_version,
    load_unmerged_entries, result_signature,
};
use crate::git::types::ChangeType;

fn file_entries(repo_path: &str, file_path: &str) -> Result<Vec<ConflictStageEntry>, String> {
    let entries = load_unmerged_entries(repo_path)?;
    let grouped = entries_by_path(entries);
    grouped
        .get(file_path)
        .cloned()
        .ok_or_else(|| "Conflict file was not found.".to_string())
}

pub(super) fn load_conflict_detail(
    repo_path: &str,
    file_path: &str,
    entries: Vec<ConflictStageEntry>,
) -> GitConflictFileDetail {
    let base = load_stage_version(repo_path, file_path, GitConflictSide::Base, 1, &entries);
    let current =
        load_stage_version(repo_path, file_path, GitConflictSide::Current, 2, &entries);
    let incoming =
        load_stage_version(repo_path, file_path, GitConflictSide::Incoming, 3, &entries);
    let result = load_result_version(repo_path, file_path);
    let conflict_kinds = conflict_kinds(&entries, result.content_kind);
    let regions = result
        .text
        .as_deref()
        .map(parse_conflict_regions)
        .unwrap_or_default();
    let signatures = GitConflictSignatures {
        index_signature: index_signature(&entries),
        result_signature: result_signature(repo_path, file_path),
    };

    GitConflictFileDetail {
        path: file_path.to_string(),
        status: ChangeType::Conflicted,
        base,
        current,
        incoming,
        content_kind: result.content_kind,
        result,
        regions,
        conflict_kinds,
        signatures,
    }
}

fn parse_conflict_regions(text: &str) -> Vec<GitConflictRegion> {
    let mut regions = Vec::new();
    let mut start_line: Option<usize> = None;
    let mut separator_line: Option<usize> = None;

    for (index, line) in text.lines().enumerate() {
        let line_number = index + 1;
        if line.starts_with("<<<<<<<") {
            start_line = Some(line_number);
            separator_line = None;
            continue;
        }

        if start_line.is_some() && line.starts_with("=======") {
            separator_line = Some(line_number);
            continue;
        }

        if let Some(start) = start_line {
            if line.starts_with(">>>>>>>") {
                regions.push(GitConflictRegion {
                    id: format!("conflict-{}", regions.len() + 1),
                    result_start_line: start,
                    result_separator_line: separator_line,
                    result_end_line: line_number,
                });
                start_line = None;
                separator_line = None;
            }
        }
    }

    regions
}

#[tauri::command]
pub fn get_merge_conflict_file(
    path: String,
    file_path: String,
) -> Result<GitConflictFileDetail, String> {
    let entries = file_entries(&path, &file_path)?;
    Ok(load_conflict_detail(&path, &file_path, entries))
}

#[tauri::command]
pub fn get_merge_conflict_content_range(
    path: String,
    file_path: String,
    side: GitConflictSide,
    start_line: usize,
    line_count: usize,
) -> Result<GitConflictContentRange, String> {
    let entries = file_entries(&path, &file_path)?;
    let detail = load_conflict_detail(&path, &file_path, entries);
    let version = match side {
        GitConflictSide::Base => detail.base.as_ref(),
        GitConflictSide::Current => detail.current.as_ref(),
        GitConflictSide::Incoming => detail.incoming.as_ref(),
        GitConflictSide::Result => Some(&detail.result),
    }
    .ok_or_else(|| "Requested conflict side is not available.".to_string())?;
    let text = version
        .text
        .as_deref()
        .ok_or_else(|| "Requested conflict side is not text.".to_string())?;
    let zero_based_start = start_line.saturating_sub(1);
    let lines = text
        .lines()
        .skip(zero_based_start)
        .take(line_count)
        .map(ToString::to_string)
        .collect();
    let signature = match side {
        GitConflictSide::Result => detail.signatures.result_signature,
        _ => detail.signatures.index_signature,
    };

    Ok(GitConflictContentRange {
        path: file_path,
        side,
        start_line,
        lines,
        total_line_count: version.size.line_count,
        signature,
    })
}

#[cfg(test)]
mod tests {
    use super::parse_conflict_regions;

    #[test]
    fn parses_worktree_conflict_markers() {
        let regions = parse_conflict_regions(
            "\
one
<<<<<<< HEAD
current
=======
incoming
>>>>>>> branch
two
",
        );

        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0].result_start_line, 2);
        assert_eq!(regions[0].result_separator_line, Some(4));
        assert_eq!(regions[0].result_end_line, 6);
    }
}
