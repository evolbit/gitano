use crate::git::diff::*;
use crate::git::types::*;

#[tauri::command]
pub fn get_file_diff_hunks_command(
    path: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    get_file_diff_hunks(path, file_path, context)
}

#[tauri::command]
pub fn get_diff_context_command(
    path: String,
    file_path: String,
    hunk_index: usize,
    direction: ContextDirection,
    lines: usize,
    context: usize,
    offset: usize,
) -> Result<Vec<DiffLine>, String> {
    get_diff_context(
        path, file_path, hunk_index, direction, lines, context, offset,
    )
}

#[tauri::command]
pub fn get_commit_file_diff_command(
    path: String,
    sha: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    get_commit_file_diff(path, sha, file_path, context)
}
