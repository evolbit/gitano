use super::helpers::{
    canonical_path, normalize_branch_ref, path_basename, same_path, worktree_display_name,
};
use crate::git::types::GitWorktree;
use std::process::Command;

#[tauri::command]
pub fn get_worktrees(path: String) -> Result<Vec<GitWorktree>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("worktree")
        .arg("list")
        .arg("--porcelain")
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "git worktree list failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let current_path = canonical_path(&path);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut worktrees = Vec::new();
    let mut main_checkout_name: Option<String> = None;

    for block in stdout
        .split("\n\n")
        .filter(|block| !block.trim().is_empty())
    {
        let mut worktree_path: Option<String> = None;
        let mut head: Option<String> = None;
        let mut branch: Option<String> = None;
        let mut is_bare = false;
        let mut is_detached = false;

        for line in block.lines() {
            if let Some(value) = line.strip_prefix("worktree ") {
                worktree_path = Some(value.to_string());
            } else if let Some(value) = line.strip_prefix("HEAD ") {
                head = Some(value.to_string());
            } else if let Some(value) = line.strip_prefix("branch ") {
                branch = Some(normalize_branch_ref(value));
            } else if line == "bare" {
                is_bare = true;
            } else if line == "detached" {
                is_detached = true;
            }
        }

        let Some(worktree_path) = worktree_path else {
            continue;
        };

        let is_main = worktrees.is_empty();
        if is_main {
            main_checkout_name = Some(path_basename(&worktree_path));
        }

        let name = if is_main {
            "main".to_string()
        } else {
            worktree_display_name(&worktree_path, main_checkout_name.as_deref())
        };

        worktrees.push(GitWorktree {
            is_current: same_path(&current_path, &worktree_path),
            path: worktree_path,
            name,
            branch,
            head,
            is_main,
            is_bare,
            is_detached,
        });
    }

    Ok(worktrees)
}
