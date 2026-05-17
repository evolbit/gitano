use crate::git::repository_state::load_repository_state;
use crate::git::types::{RepositoryHeadStatus, RepositoryState};
use git2::{BranchType, Repository, RepositoryInitOptions};
use std::path::Path;
use tauri::command;

#[command]
pub fn open_local_repo(path: String) -> Result<String, String> {
    load_repository_state(&path)
        .map(|_| format!("Repositorio abierto correctamente: {}", path))
        .map_err(|e| format!("No es un repositorio git válido: {}", e))
}

#[command]
pub fn get_repository_state(path: String) -> Result<RepositoryState, String> {
    load_repository_state(&path)
}

#[command]
pub fn init_local_repo(path: String) -> Result<String, String> {
    let selected_path = Path::new(&path);
    if !selected_path.exists() {
        return Err("Selected path does not exist.".to_string());
    }
    if !selected_path.is_dir() {
        return Err("Selected path must be a folder.".to_string());
    }

    if Repository::open(&path).is_err() {
        let mut options = RepositoryInitOptions::new();
        options.initial_head("main");
        Repository::init_opts(&path, &options)
            .map_err(|e| format!("Could not initialize repository: {e}"))?;
    }

    load_repository_state(&path)
        .map(|_| format!("Repositorio creado correctamente: {}", path))
        .map_err(|e| format!("Could not open initialized repository: {e}"))
}

#[command]
pub fn get_branches(path: String) -> Result<Vec<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut branches = Vec::new();
    let branch_iter = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| e.to_string())?;
    for branch in branch_iter {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        if let Some(name) = branch.name().map_err(|e| e.to_string())? {
            branches.push(name.to_string());
        }
    }
    Ok(branches)
}

#[command]
pub fn get_remote_branches(path: String) -> Result<Vec<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut branches = Vec::new();
    let branch_iter = repo
        .branches(Some(BranchType::Remote))
        .map_err(|e| e.to_string())?;
    for branch in branch_iter {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        if let Some(name) = branch.name().map_err(|e| e.to_string())? {
            branches.push(name.to_string());
        }
    }
    Ok(branches)
}

#[command]
pub fn get_tags(path: String) -> Result<Vec<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let tag_names = repo.tag_names(None).map_err(|e| e.to_string())?;
    let mut tags: Vec<String> = tag_names
        .iter()
        .flatten()
        .map(ToString::to_string)
        .collect();
    tags.sort();
    Ok(tags)
}

#[command]
pub fn get_remote_url(path: String, remote_name: Option<String>) -> Result<Option<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let remote_name = remote_name.unwrap_or_else(|| "origin".to_string());
    let remote = match repo.find_remote(&remote_name) {
        Ok(remote) => remote,
        Err(_) => return Ok(None),
    };

    Ok(remote.url().map(ToString::to_string))
}

#[command]
pub fn get_current_branch(path: String) -> Result<String, String> {
    let state = load_repository_state(&path)?;

    match state.head_status {
        RepositoryHeadStatus::Detached => Ok("Detached HEAD".to_string()),
        RepositoryHeadStatus::Normal | RepositoryHeadStatus::Unborn => state
            .branch
            .ok_or_else(|| "Could not resolve current branch".to_string()),
        RepositoryHeadStatus::Unknown => state
            .branch
            .ok_or_else(|| "Could not resolve repository HEAD state".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};
    use tempfile::tempdir;

    #[test]
    fn current_branch_returns_unborn_symbolic_branch() {
        let repo = init_repo();

        let branch = get_current_branch(repo.path().to_string_lossy().to_string())
            .expect("unborn branch should resolve");

        assert_eq!(branch, "main");
    }

    #[test]
    fn current_branch_returns_detached_head_label() {
        let repo = init_repo();
        let sha = commit_file(repo.path(), "file.txt", "hello\n", "initial");
        run_git(repo.path(), &["checkout", "--detach", &sha]);

        let branch = get_current_branch(repo.path().to_string_lossy().to_string())
            .expect("detached repository should resolve");

        assert_eq!(branch, "Detached HEAD");
    }

    #[test]
    fn init_local_repo_initializes_plain_directory() {
        let dir = tempdir().expect("temp dir should be created");

        let result = init_local_repo(dir.path().to_string_lossy().to_string())
            .expect("plain folder should be initialized");

        assert!(result.starts_with("Repositorio creado correctamente:"));
        assert!(dir.path().join(".git").is_dir());

        let state = load_repository_state(&dir.path().to_string_lossy())
            .expect("initialized repo should be valid");
        assert_eq!(state.head_status, RepositoryHeadStatus::Unborn);
        assert_eq!(state.branch.as_deref(), Some("main"));
        assert!(!state.has_commits);
    }

    #[test]
    fn init_local_repo_accepts_existing_repository() {
        let repo = init_repo();

        init_local_repo(repo.path().to_string_lossy().to_string())
            .expect("existing repository should be accepted");

        let state = load_repository_state(&repo.path().to_string_lossy())
            .expect("existing repository should remain valid");
        assert_eq!(state.head_status, RepositoryHeadStatus::Unborn);
    }

    #[test]
    fn init_local_repo_rejects_file_path() {
        let dir = tempdir().expect("temp dir should be created");
        let file_path = dir.path().join("not-a-folder.txt");
        std::fs::write(&file_path, "content").expect("file should be written");

        let error = init_local_repo(file_path.to_string_lossy().to_string())
            .expect_err("file path should be rejected");

        assert_eq!(error, "Selected path must be a folder.");
    }
}
