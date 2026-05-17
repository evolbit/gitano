use crate::git::repository_state::{ensure_repository_has_commits, load_repository_state};
use std::process::Command;

fn validate_local_branch_name(branch_name: &str) -> Result<&str, String> {
    let branch_name = branch_name.trim();

    if branch_name.is_empty() {
        return Err("Branch is required.".to_string());
    }

    Ok(branch_name)
}

fn validate_branch_name_format(path: &str, branch_name: &str) -> Result<(), String> {
    run_git_status(
        path,
        &["check-ref-format", "--branch", branch_name],
        "git check-ref-format",
    )
    .map_err(|_| format!("Invalid branch name: {}", branch_name))
}

fn run_git_status(path: &str, args: &[&str], action: &str) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "{} failed: {}",
        action,
        String::from_utf8_lossy(&output.stderr)
    ))
}

fn run_git_output(path: &str, args: &[&str], action: &str) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    Err(format!(
        "{} failed: {}",
        action,
        String::from_utf8_lossy(&output.stderr)
    ))
}

fn ensure_base_ref_can_create_branch(path: &str, base_ref: &str) -> Result<(), String> {
    let state = load_repository_state(path)?;
    if state.has_commits {
        return Ok(());
    }

    if Some(base_ref) == state.branch.as_deref() || base_ref == "HEAD" {
        return Err(
            "git branch requires an initial commit when the base ref is the unborn current branch. Create the initial commit before trying again."
                .to_string(),
        );
    }

    Ok(())
}

fn ensure_local_branch(path: &str, branch_name: &str) -> Result<(), String> {
    let ref_name = format!("refs/heads/{}", branch_name);
    run_git_status(
        path,
        &["show-ref", "--verify", "--quiet", &ref_name],
        "git show-ref",
    )
    .map_err(|_| format!("Remote actions require a local branch: {}", branch_name))
}

fn current_branch(path: &str) -> Result<String, String> {
    run_git_output(
        path,
        &["branch", "--show-current"],
        "git branch --show-current",
    )
}

fn ensure_branch_can_fast_forward(
    path: &str,
    target_branch: &str,
    source_branch: &str,
) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["merge-base", "--is-ancestor", target_branch, source_branch])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "Cannot fast-forward {} to {} because {} is not an ancestor of {}.",
        target_branch, source_branch, target_branch, source_branch
    ))
}

fn get_branch_upstream(path: &str, branch_name: &str) -> Result<String, String> {
    let upstream_ref = format!("{}@{{upstream}}", branch_name);
    run_git_output(
        path,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            &upstream_ref,
        ],
        "git rev-parse",
    )
    .map_err(|_| {
        format!(
            "No upstream configured for {}. Use Set Upstream first.",
            branch_name
        )
    })
}

fn split_upstream(upstream: &str) -> Result<(&str, &str), String> {
    upstream
        .split_once('/')
        .filter(|(remote, branch)| !remote.is_empty() && !branch.is_empty())
        .ok_or_else(|| format!("Could not parse upstream reference: {}", upstream))
}

#[tauri::command]
pub async fn git_branch_push(path: String, branch_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git push")?;
        let branch_name = validate_local_branch_name(&branch_name)?;
        ensure_local_branch(&path, branch_name)?;
        run_git_status(&path, &["push", "origin", branch_name], "git push")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_branch_set_upstream(path: String, branch_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git push --set-upstream")?;
        let branch_name = validate_local_branch_name(&branch_name)?;
        ensure_local_branch(&path, branch_name)?;
        run_git_status(
            &path,
            &["push", "--set-upstream", "origin", branch_name],
            "git push --set-upstream",
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_checkout_branch(path: String, branch_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git checkout")?;
        let branch_name = validate_local_branch_name(&branch_name)?;
        ensure_local_branch(&path, branch_name)
            .map_err(|_| format!("Checkout requires a local branch: {}", branch_name))?;
        run_git_status(&path, &["checkout", branch_name], "git checkout")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_create_branch(
    path: String,
    branch_name: String,
    base_ref: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let branch_name = validate_local_branch_name(&branch_name)?;
        let base_ref = base_ref.trim();

        if base_ref.is_empty() {
            return Err("Base ref is required.".to_string());
        }

        ensure_base_ref_can_create_branch(&path, base_ref)?;

        run_git_status(
            &path,
            &["branch", "--", branch_name, base_ref],
            "git branch",
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_branch_fast_forward_to_branch(
    path: String,
    target_branch: String,
    source_branch: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git merge --ff-only")?;
        let target_branch = validate_local_branch_name(&target_branch)?;
        let source_branch = validate_local_branch_name(&source_branch)?;
        ensure_local_branch(&path, target_branch)
            .map_err(|_| format!("Target branch not found: {}", target_branch))?;
        ensure_local_branch(&path, source_branch)
            .map_err(|_| format!("Source branch not found: {}", source_branch))?;

        if target_branch == source_branch {
            return Ok(());
        }

        let current_branch = current_branch(&path)?;
        if current_branch == target_branch {
            return run_git_status(
                &path,
                &["merge", "--ff-only", source_branch],
                "git merge --ff-only",
            );
        }

        ensure_branch_can_fast_forward(&path, target_branch, source_branch)?;
        run_git_status(
            &path,
            &["branch", "-f", target_branch, source_branch],
            "git branch -f",
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_branch_merge_into(
    path: String,
    target_branch: String,
    source_branch: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git merge")?;
        let target_branch = validate_local_branch_name(&target_branch)?;
        let source_branch = validate_local_branch_name(&source_branch)?;
        ensure_local_branch(&path, target_branch)
            .map_err(|_| format!("Target branch not found: {}", target_branch))?;
        ensure_local_branch(&path, source_branch)
            .map_err(|_| format!("Source branch not found: {}", source_branch))?;

        if target_branch == source_branch {
            return Ok(());
        }

        run_git_status(&path, &["checkout", target_branch], "git checkout")?;
        run_git_status(&path, &["merge", source_branch], "git merge")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_branch_rebase_onto(
    path: String,
    target_branch: String,
    source_branch: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git rebase")?;
        let target_branch = validate_local_branch_name(&target_branch)?;
        let source_branch = validate_local_branch_name(&source_branch)?;
        ensure_local_branch(&path, target_branch)
            .map_err(|_| format!("Target branch not found: {}", target_branch))?;
        ensure_local_branch(&path, source_branch)
            .map_err(|_| format!("Source branch not found: {}", source_branch))?;

        if target_branch == source_branch {
            return Ok(());
        }

        run_git_status(&path, &["checkout", target_branch], "git checkout")?;
        run_git_status(&path, &["rebase", source_branch], "git rebase")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_rename_branch(
    path: String,
    old_branch_name: String,
    new_branch_name: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git branch -m")?;
        let old_branch_name = validate_local_branch_name(&old_branch_name)?;
        let new_branch_name = validate_local_branch_name(&new_branch_name)?;
        validate_branch_name_format(&path, new_branch_name)?;
        ensure_local_branch(&path, old_branch_name)
            .map_err(|_| format!("Branch not found: {}", old_branch_name))?;

        if old_branch_name == new_branch_name {
            return Ok(());
        }

        run_git_status(
            &path,
            &["branch", "-m", old_branch_name, new_branch_name],
            "git branch -m",
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_delete_branch(path: String, branch_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git branch -d")?;
        let branch_name = validate_local_branch_name(&branch_name)?;
        ensure_local_branch(&path, branch_name)
            .map_err(|_| format!("Branch not found: {}", branch_name))?;

        if current_branch(&path)? == branch_name {
            return Err(format!(
                "Cannot delete the checked-out branch: {}",
                branch_name
            ));
        }

        run_git_status(&path, &["branch", "-d", branch_name], "git branch -d")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_branch_tip_sha(path: String, branch_name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git rev-parse")?;
        let branch_name = validate_local_branch_name(&branch_name)?;
        let candidates = [
            format!("refs/heads/{}", branch_name),
            format!("refs/remotes/{}", branch_name),
            branch_name.to_string(),
        ];

        for candidate in candidates {
            let verify_ref = format!("{}^{{commit}}", candidate);
            if let Ok(sha) = run_git_output(
                &path,
                &["rev-parse", "--verify", &verify_ref],
                "git rev-parse",
            ) {
                return Ok(sha);
            }
        }

        Err(format!("Could not resolve branch tip: {}", branch_name))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_branch_pull_fast_forward(path: String, branch_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git branch pull")?;
        let branch_name = validate_local_branch_name(&branch_name)?;
        ensure_local_branch(&path, branch_name)?;

        let upstream = get_branch_upstream(&path, branch_name)?;
        let (remote, remote_branch) = split_upstream(&upstream)?;
        let current_branch = current_branch(&path)?;

        if current_branch == branch_name {
            run_git_status(&path, &["fetch", remote, remote_branch], "git fetch")?;
            run_git_status(&path, &["merge", "--ff-only", &upstream], "git merge")
        } else {
            let refspec = format!("{}:{}", remote_branch, branch_name);
            run_git_status(&path, &["fetch", remote, &refspec], "git fetch")
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
