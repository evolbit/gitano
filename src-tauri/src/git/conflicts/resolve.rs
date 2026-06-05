use super::detail::load_conflict_detail;
use super::types::{GitConflictFileDetail, GitConflictSide};
use super::{
    assert_current_signatures, load_result_version, load_stage_version, remove_worktree_file,
    run_git, write_worktree_file,
};

fn has_unresolved_conflict_markers(text: &str) -> bool {
    let mut has_start = false;
    let mut has_separator = false;

    for line in text.lines() {
        if line.starts_with("<<<<<<<") {
            has_start = true;
            has_separator = false;
            continue;
        }

        if has_start && line.starts_with("=======") {
            has_separator = true;
            continue;
        }

        if has_start && has_separator && line.starts_with(">>>>>>>") {
            return true;
        }
    }

    false
}

fn reload_detail(
    repo_path: &str,
    file_path: &str,
    entries: Vec<super::types::ConflictStageEntry>,
) -> GitConflictFileDetail {
    load_conflict_detail(repo_path, file_path, entries)
}

#[tauri::command]
pub fn git_write_conflict_result(
    path: String,
    file_path: String,
    content: String,
    expected_index_signature: String,
    expected_result_signature: String,
) -> Result<GitConflictFileDetail, String> {
    let entries = assert_current_signatures(
        &path,
        &file_path,
        &expected_index_signature,
        &expected_result_signature,
    )?;
    write_worktree_file(&path, &file_path, &content)?;
    Ok(reload_detail(&path, &file_path, entries))
}

#[tauri::command]
pub fn git_accept_conflict_side(
    path: String,
    file_path: String,
    side: GitConflictSide,
    expected_index_signature: String,
    expected_result_signature: String,
) -> Result<GitConflictFileDetail, String> {
    let entries = assert_current_signatures(
        &path,
        &file_path,
        &expected_index_signature,
        &expected_result_signature,
    )?;
    let stage = match side {
        GitConflictSide::Base => 1,
        GitConflictSide::Current => 2,
        GitConflictSide::Incoming => 3,
        GitConflictSide::Result => {
            return Err("Result side cannot be accepted as a conflict side.".to_string())
        }
    };
    if !entries.iter().any(|entry| entry.stage == stage) {
        if matches!(side, GitConflictSide::Current | GitConflictSide::Incoming) {
            remove_worktree_file(&path, &file_path)?;
            return Ok(reload_detail(&path, &file_path, entries));
        }
    }

    let version = load_stage_version(&path, &file_path, side, stage, &entries)
        .ok_or_else(|| "Requested conflict side is not available.".to_string())?;
    let text = version
        .text
        .ok_or_else(|| "Requested conflict side is not text.".to_string())?;

    write_worktree_file(&path, &file_path, &text)?;
    Ok(reload_detail(&path, &file_path, entries))
}

#[tauri::command]
pub fn git_mark_conflict_resolved(
    path: String,
    file_path: String,
    expected_index_signature: String,
    expected_result_signature: String,
) -> Result<(), String> {
    assert_current_signatures(
        &path,
        &file_path,
        &expected_index_signature,
        &expected_result_signature,
    )?;
    if load_result_version(&path, &file_path)
        .text
        .as_deref()
        .is_some_and(has_unresolved_conflict_markers)
    {
        return Err(
            "Resolve or remove remaining conflict markers before marking this file resolved."
                .to_string(),
        );
    }

    run_git(&path, &["add", "--", &file_path]).map(|_| ())
}
