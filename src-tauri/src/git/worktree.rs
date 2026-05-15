use crate::git::types::GitWorktree;
use std::fs;
use std::path::Path;
use std::process::Command;

fn normalize_branch_ref(ref_name: &str) -> String {
    ref_name
        .strip_prefix("refs/heads/")
        .or_else(|| ref_name.strip_prefix("refs/remotes/"))
        .unwrap_or(ref_name)
        .to_string()
}

fn path_basename(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or(path)
        .to_string()
}

fn parent_basename(path: &str) -> Option<String> {
    Path::new(path)
        .parent()
        .and_then(|value| value.file_name())
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn worktree_display_name(path: &str, main_checkout_name: Option<&str>) -> String {
    let basename = path_basename(path);

    match main_checkout_name {
        Some(main_name) if basename == main_name => parent_basename(path).unwrap_or(basename),
        _ => basename,
    }
}

fn canonical_path(path: &str) -> String {
    fs::canonicalize(path)
        .ok()
        .and_then(|value| value.to_str().map(ToString::to_string))
        .unwrap_or_else(|| path.to_string())
}

fn same_path(left: &str, right: &str) -> bool {
    canonical_path(left) == canonical_path(right)
}

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
