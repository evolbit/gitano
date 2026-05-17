use super::helpers::run_git_status;

#[tauri::command]
pub fn git_stash_pop(path: String, stash_ref: Option<String>) -> Result<(), String> {
    if let Some(stash_ref) = stash_ref {
        run_git_status(&path, &["stash", "pop", &stash_ref])
    } else {
        run_git_status(&path, &["stash", "pop"])
    }
}

#[tauri::command]
pub fn git_stash_apply(path: String, stash_ref: String) -> Result<(), String> {
    run_git_status(&path, &["stash", "apply", &stash_ref])
}

#[tauri::command]
pub fn git_stash_drop(path: String, stash_ref: String) -> Result<(), String> {
    run_git_status(&path, &["stash", "drop", &stash_ref])
}
