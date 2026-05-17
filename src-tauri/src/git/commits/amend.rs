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
        .amend(None, None, None, None, Some(&new_message), None)
        .map_err(|e| e.to_string())?;

    Ok(())
}
