use crate::git::diff::get_commit_file_diff;
use crate::git::types::DiffHunk;

#[tauri::command]
pub fn get_stash_file_diff(
    path: String,
    sha: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    get_commit_file_diff(path, sha, file_path, context)
}
