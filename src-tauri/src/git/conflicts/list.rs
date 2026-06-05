use super::{
    conflict_kinds, entries_by_path, index_signature, load_result_version, load_unmerged_entries,
    result_signature,
};
use crate::git::types::ChangeType;
use super::types::{GitConflictContentKind, GitConflictSummary};

#[tauri::command]
pub fn get_merge_conflicts(path: String) -> Result<Vec<GitConflictSummary>, String> {
    let entries = load_unmerged_entries(&path)?;
    let grouped = entries_by_path(entries);
    let mut summaries = Vec::new();

    for (file_path, file_entries) in grouped {
        let result = load_result_version(&path, &file_path);
        let content_kind = result.content_kind;
        let conflict_kinds = conflict_kinds(&file_entries, content_kind);
        let file_signature = super::digest_parts(&[
            &index_signature(&file_entries),
            &result_signature(&path, &file_path),
        ]);

        summaries.push(GitConflictSummary {
            path: file_path,
            status: ChangeType::Conflicted,
            conflict_count: 1,
            conflict_kinds,
            content_kind: if content_kind == GitConflictContentKind::Missing {
                GitConflictContentKind::Unsupported
            } else {
                content_kind
            },
            size: result.size,
            file_signature,
        });
    }

    Ok(summaries)
}
