use super::helpers::same_path;
use super::list::get_worktrees;
use std::process::Command;

#[tauri::command]
pub fn git_remove_worktree(
    path: String,
    worktree_path: String,
    force: Option<bool>,
) -> Result<(), String> {
    let worktree_path = worktree_path.trim();
    let force = force.unwrap_or(false);

    if worktree_path.is_empty() {
        return Err("Worktree path is required.".to_string());
    }

    let worktrees = get_worktrees(path.clone())?;
    let Some(target) = worktrees
        .iter()
        .find(|worktree| same_path(&worktree.path, worktree_path))
    else {
        return Err("Worktree was not found.".to_string());
    };

    if target.is_main {
        return Err("The main worktree cannot be removed.".to_string());
    }

    if target.is_current {
        return Err("The active worktree cannot be removed.".to_string());
    }

    let mut command = Command::new("git");
    command.arg("-C").arg(&path).arg("worktree").arg("remove");

    if force {
        command.arg("--force");
    }

    let output = command
        .arg(worktree_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git worktree remove failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_blank_paths_before_listing_worktrees() {
        let result = git_remove_worktree("/repo".to_string(), " ".to_string(), None);

        assert_eq!(result, Err("Worktree path is required.".to_string()));
    }
}
