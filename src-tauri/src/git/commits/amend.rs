use crate::git::repository_state::ensure_repository_has_commits;
use git2::{Oid, Repository};
use tauri::command;

#[command]
pub fn amend_commit_message(path: String, sha: String, new_message: String) -> Result<(), String> {
    ensure_repository_has_commits(&path, "git commit --amend")?;

    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let oid = Oid::from_str(&sha).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    // No se puede enmendar un commit de merge
    if commit.parent_count() > 1 {
        return Err("Cannot amend a merge commit.".to_string());
    }

    // Solo enmendar si el commit es el HEAD actual de alguna rama
    let head = repo.head().map_err(|e| e.to_string())?;
    let head_oid = head.target().ok_or("Could not get HEAD OID")?;

    if head_oid != oid {
        return Err("Can only amend the most recent commit on the current branch.".to_string());
    }

    commit
        .amend(Some("HEAD"), None, None, None, Some(&new_message), None)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo};
    use std::path::Path;
    use std::process::Command;

    #[test]
    fn amend_commit_message_preserves_multiline_message_body() {
        let repo = init_repo();
        let sha = commit_file(repo.path(), "file.txt", "hello\n", "initial");

        amend_commit_message(
            repo.path().to_string_lossy().to_string(),
            sha,
            "Subject line\n\nBody line".to_string(),
        )
        .expect("amend should succeed");

        assert_eq!(head_message(repo.path()), "Subject line\n\nBody line");
    }

    fn head_message(repo_path: &Path) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .args(["log", "-1", "--pretty=%B"])
            .output()
            .expect("git log should run");

        assert!(output.status.success(), "git log should succeed");
        String::from_utf8_lossy(&output.stdout)
            .trim_end_matches('\n')
            .to_string()
    }
}
