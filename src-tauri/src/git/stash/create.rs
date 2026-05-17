use super::helpers::{resolve_stash_message, run_git_status};
use std::process::Command;

#[tauri::command]
pub fn git_stash_all(path: String, message: Option<String>) -> Result<(), String> {
    let stash_message = resolve_stash_message(&path, message)?;
    run_git_status(&path, &["stash", "push", "-u", "-m", &stash_message])
}

#[tauri::command]
pub fn git_stash_selected(
    path: String,
    file_paths: Vec<String>,
    message: Option<String>,
) -> Result<(), String> {
    if file_paths.is_empty() {
        return Err("No files selected for stash.".to_string());
    }

    let stash_message = resolve_stash_message(&path, message)?;
    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(&path)
        .arg("stash")
        .arg("push")
        .arg("-u")
        .arg("-m")
        .arg(stash_message)
        .arg("--");

    for file_path in &file_paths {
        cmd.arg(file_path);
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git stash push (selected files) failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::stash::git_stash_list;
    use crate::git::test_support::{commit_file, init_repo, write_file};

    #[test]
    fn rejects_empty_file_selections_before_running_git() {
        let result = git_stash_selected("/repo".to_string(), Vec::new(), None);

        assert_eq!(result, Err("No files selected for stash.".to_string()));
    }

    #[test]
    fn creates_a_stash_with_a_custom_message() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");
        write_file(repo.path(), "file.txt", "one\ntwo\n");

        git_stash_all(
            repo.path().to_string_lossy().to_string(),
            Some("custom stash".to_string()),
        )
        .expect("stash should be created");

        let stashes =
            git_stash_list(repo.path().to_string_lossy().to_string()).expect("stash exists");
        assert_eq!(stashes.len(), 1);
        assert!(stashes[0].message.contains("custom stash"));
    }
}
