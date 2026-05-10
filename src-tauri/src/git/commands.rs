use crate::git::diff::{
    get_commit_file_diff as load_commit_file_diff,
    get_diff_context as load_diff_context,
    get_file_diff_hunks as load_file_diff_hunks,
    get_index_diffs_for_files as load_index_diffs_for_files,
};
use crate::git::types::*;
use std::collections::HashMap;

#[tauri::command]
pub fn get_file_diff_hunks(
    path: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    load_file_diff_hunks(path, file_path, context)
}

#[tauri::command]
pub fn get_diff_context(
    path: String,
    file_path: String,
    hunk_index: usize,
    direction: ContextDirection,
    lines: usize,
    context: usize,
    offset: usize,
) -> Result<Vec<DiffLine>, String> {
    load_diff_context(
        path, file_path, hunk_index, direction, lines, context, offset,
    )
}

#[tauri::command]
pub fn get_commit_file_diff(
    path: String,
    sha: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    load_commit_file_diff(path, sha, file_path, context)
}

#[tauri::command]
pub fn get_index_diffs_for_files(
    path: String,
    file_paths: Vec<String>,
    context: usize,
) -> Result<HashMap<String, Vec<DiffHunk>>, String> {
    load_index_diffs_for_files(path, file_paths, context)
}
