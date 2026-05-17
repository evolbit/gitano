use crate::git::diff::{
    get_branch_comparison_file_diff as load_branch_comparison_file_diff,
    get_branch_comparison_files as load_branch_comparison_files,
    get_commit_file_diff as load_commit_file_diff,
    get_commit_worktree_comparison_file_diff as load_commit_worktree_comparison_file_diff,
    get_commit_worktree_comparison_files as load_commit_worktree_comparison_files,
    get_diff_context as load_diff_context, get_file_diff_hunks as load_file_diff_hunks,
    get_index_diffs_for_files as load_index_diffs_for_files, BranchComparisonMode,
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
pub fn get_commit_worktree_comparison_files(
    path: String,
    base_ref: String,
) -> Result<Vec<FileChange>, String> {
    load_commit_worktree_comparison_files(path, base_ref)
}

#[tauri::command]
pub fn get_commit_worktree_comparison_file_diff(
    path: String,
    base_ref: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    load_commit_worktree_comparison_file_diff(path, base_ref, file_path, context)
}

#[tauri::command]
pub fn get_branch_comparison_files(
    path: String,
    base_ref: String,
    head_ref: String,
    comparison_mode: Option<BranchComparisonMode>,
) -> Result<Vec<FileChange>, String> {
    load_branch_comparison_files(path, base_ref, head_ref, comparison_mode)
}

#[tauri::command]
pub fn get_branch_comparison_file_diff(
    path: String,
    base_ref: String,
    head_ref: String,
    file_path: String,
    context: usize,
    comparison_mode: Option<BranchComparisonMode>,
) -> Result<Vec<DiffHunk>, String> {
    load_branch_comparison_file_diff(
        path,
        base_ref,
        head_ref,
        file_path,
        context,
        comparison_mode,
    )
}

#[tauri::command]
pub fn get_index_diffs_for_files(
    path: String,
    file_paths: Vec<String>,
    context: usize,
) -> Result<HashMap<String, Vec<DiffHunk>>, String> {
    load_index_diffs_for_files(path, file_paths, context)
}
