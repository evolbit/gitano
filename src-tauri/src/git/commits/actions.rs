use std::process::Command;

fn validate_commit_ref(path: &str, sha: &str) -> Result<String, String> {
    let sha = sha.trim();

    if sha.is_empty() {
        return Err("Commit SHA is required.".to_string());
    }

    let commit_ref = format!("{}^{{commit}}", sha);
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "--verify", &commit_ref])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    Err(format!(
        "Could not resolve commit '{}': {}",
        sha,
        String::from_utf8_lossy(&output.stderr)
    ))
}

fn ensure_current_branch(path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["branch", "--show-current"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "Could not read current branch: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if branch.is_empty() {
        return Err("A current branch is required for this operation.".to_string());
    }

    Ok(branch)
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

#[tauri::command]
pub fn git_commit_patch(path: String, sha: String) -> Result<String, String> {
    let sha = validate_commit_ref(&path, &sha)?;
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .args(["format-patch", "-1", "--stdout", &sha])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    Err(format!(
        "git format-patch failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_cherry_pick_commit(path: String, sha: String) -> Result<(), String> {
    let sha = validate_commit_ref(&path, &sha)?;
    ensure_current_branch(&path)?;
    run_git_status(&path, &["cherry-pick", &sha], "git cherry-pick")
}

#[tauri::command]
pub fn git_revert_commit(path: String, sha: String) -> Result<(), String> {
    let sha = validate_commit_ref(&path, &sha)?;
    ensure_current_branch(&path)?;
    run_git_status(&path, &["revert", "--no-edit", &sha], "git revert")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};

    #[test]
    fn generates_patch_for_commit() {
        let repo = init_repo();
        let sha = commit_file(repo.path(), "file.txt", "hello\n", "add file");

        let patch = git_commit_patch(repo.path().to_string_lossy().to_string(), sha)
            .expect("patch should be generated");

        assert!(patch.contains("Subject: [PATCH] add file"));
        assert!(patch.contains("+hello"));
    }

    #[test]
    fn cherry_picks_commit_onto_current_branch() {
        let repo = init_repo();
        commit_file(repo.path(), "base.txt", "base\n", "base");
        run_git(repo.path(), &["checkout", "-b", "feature"]);
        let sha = commit_file(repo.path(), "feature.txt", "feature\n", "feature");
        run_git(repo.path(), &["checkout", "main"]);

        git_cherry_pick_commit(repo.path().to_string_lossy().to_string(), sha)
            .expect("cherry-pick should succeed");

        run_git(repo.path(), &["show", "HEAD:feature.txt"]);
    }

    #[test]
    fn rejects_blank_commit_for_revert() {
        let error = git_revert_commit("/does-not-need-to-exist".to_string(), " ".to_string())
            .expect_err("blank commit should be rejected");

        assert_eq!(error, "Commit SHA is required.");
    }

    #[test]
    fn rejects_unknown_commit_for_patch() {
        let repo = init_repo();
        let error = git_commit_patch(
            repo.path().to_string_lossy().to_string(),
            "0000000000000000000000000000000000000000".to_string(),
        )
        .expect_err("unknown commit should be rejected");

        assert!(error.contains("Could not resolve commit"));
    }
}
