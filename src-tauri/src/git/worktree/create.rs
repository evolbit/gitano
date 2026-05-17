use super::helpers::same_path;
use super::list::get_worktrees;
use crate::git::repository_state::ensure_repository_has_commits;
use crate::git::types::GitWorktree;
use std::fs;
use std::path::Path;
use std::process::Command;

#[tauri::command]
pub fn git_create_worktree(
    path: String,
    worktree_path: String,
    branch: String,
    base_ref: String,
) -> Result<GitWorktree, String> {
    let branch = branch.trim();
    let base_ref = base_ref.trim();
    let worktree_path = worktree_path.trim();

    if branch.is_empty() {
        return Err("Branch is required to create a worktree.".to_string());
    }

    if base_ref.is_empty() {
        return Err("Base ref is required to create a worktree.".to_string());
    }

    if worktree_path.is_empty() {
        return Err("Worktree folder is required.".to_string());
    }

    ensure_repository_has_commits(&path, "git worktree add")?;

    if let Some(parent) = Path::new(worktree_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("worktree")
        .arg("add")
        .arg("-b")
        .arg(branch)
        .arg(worktree_path)
        .arg(base_ref)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "git worktree add failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let worktrees = get_worktrees(path)?;
    worktrees
        .into_iter()
        .find(|worktree| same_path(&worktree.path, worktree_path))
        .ok_or_else(|| "Created worktree was not found after creation.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_missing_required_fields_before_running_git() {
        let result = git_create_worktree(
            "/repo".to_string(),
            "/tmp/worktree".to_string(),
            " ".to_string(),
            "main".to_string(),
        );

        assert_eq!(
            result.expect_err("missing branch should fail"),
            "Branch is required to create a worktree."
        );
    }
}
