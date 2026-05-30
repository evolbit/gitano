use crate::git::repository_state::load_repository_state;
use crate::git::types::{BranchRefPresence, GitBranchRef, RepositoryHeadStatus, RepositoryState};
use git2::{BranchType, Oid, Repository, RepositoryInitOptions};
use std::collections::BTreeMap;
use std::path::Path;
use tauri::command;

const ORIGIN_REMOTE_PREFIX: &str = "origin/";
const ORIGIN_REMOTE_REF_PREFIX: &str = "refs/remotes/origin/";
const ORIGIN_HEAD_BRANCH: &str = "HEAD";

#[derive(Debug, Clone)]
struct BranchRefInfo {
    name: String,
    target_id: Option<Oid>,
    upstream_name: Option<String>,
}

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
pub fn get_branch_refs(path: String) -> Result<Vec<GitBranchRef>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let local_branches = load_local_branch_refs(&repo)?;
    let mut origin_branches = load_origin_branch_refs(&repo)?;
    let mut refs = Vec::with_capacity(local_branches.len() + origin_branches.len());

    for (local_name, local_info) in local_branches {
        let origin_key = origin_counterpart_key(&local_name, local_info.upstream_name.as_deref());
        let origin_info = origin_branches.remove(&origin_key);
        let (ahead_count, behind_count) = ahead_behind_counts(
            &repo,
            local_info.target_id,
            origin_info.as_ref().and_then(|info| info.target_id),
        )?;

        refs.push(GitBranchRef {
            name: local_name,
            local_name: Some(local_info.name),
            origin_name: origin_info.as_ref().map(|info| info.name.clone()),
            local_target_id: oid_to_string(local_info.target_id),
            origin_target_id: origin_info
                .as_ref()
                .and_then(|info| oid_to_string(info.target_id)),
            upstream_name: local_info.upstream_name,
            presence: if origin_info.is_some() {
                BranchRefPresence::LocalOrigin
            } else {
                BranchRefPresence::Local
            },
            ahead_count,
            behind_count,
        });
    }

    for (origin_name, origin_info) in origin_branches {
        refs.push(GitBranchRef {
            name: origin_name,
            local_name: None,
            origin_name: Some(origin_info.name),
            local_target_id: None,
            origin_target_id: oid_to_string(origin_info.target_id),
            upstream_name: None,
            presence: BranchRefPresence::Origin,
            ahead_count: None,
            behind_count: None,
        });
    }

    refs.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(refs)
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

fn load_local_branch_refs(repo: &Repository) -> Result<BTreeMap<String, BranchRefInfo>, String> {
    let mut branches = BTreeMap::new();
    let branch_iter = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| e.to_string())?;

    for branch in branch_iter {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        if let Some(name) = branch.name().map_err(|e| e.to_string())? {
            branches.insert(
                name.to_string(),
                BranchRefInfo {
                    name: name.to_string(),
                    target_id: branch.get().target(),
                    upstream_name: branch_upstream_name(&branch),
                },
            );
        }
    }

    Ok(branches)
}

fn load_origin_branch_refs(repo: &Repository) -> Result<BTreeMap<String, BranchRefInfo>, String> {
    let mut branches = BTreeMap::new();
    let branch_iter = repo
        .branches(Some(BranchType::Remote))
        .map_err(|e| e.to_string())?;

    for branch in branch_iter {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        let Some(name) = branch.name().map_err(|e| e.to_string())? else {
            continue;
        };
        let Some(logical_name) = origin_logical_name(name) else {
            continue;
        };

        branches.insert(
            logical_name.to_string(),
            BranchRefInfo {
                name: name.to_string(),
                target_id: branch.get().target(),
                upstream_name: None,
            },
        );
    }

    Ok(branches)
}

fn branch_upstream_name(branch: &git2::Branch<'_>) -> Option<String> {
    branch
        .upstream()
        .ok()
        .and_then(|upstream| upstream.name().ok().flatten().map(ToString::to_string))
}

fn origin_logical_name(remote_name: &str) -> Option<&str> {
    let logical_name = remote_name
        .strip_prefix(ORIGIN_REMOTE_PREFIX)
        .or_else(|| remote_name.strip_prefix(ORIGIN_REMOTE_REF_PREFIX))?;
    if logical_name == ORIGIN_HEAD_BRANCH || logical_name.is_empty() {
        return None;
    }
    Some(logical_name)
}

fn origin_counterpart_key(local_name: &str, upstream_name: Option<&str>) -> String {
    upstream_name
        .and_then(origin_logical_name)
        .unwrap_or(local_name)
        .to_string()
}

fn ahead_behind_counts(
    repo: &Repository,
    local_id: Option<Oid>,
    origin_id: Option<Oid>,
) -> Result<(Option<usize>, Option<usize>), String> {
    match (local_id, origin_id) {
        (Some(local_id), Some(origin_id)) => repo
            .graph_ahead_behind(local_id, origin_id)
            .map(|(ahead, behind)| (Some(ahead), Some(behind)))
            .map_err(|e| e.to_string()),
        _ => Ok((None, None)),
    }
}

fn oid_to_string(oid: Option<Oid>) -> Option<String> {
    oid.map(|oid| oid.to_string())
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
    fn branch_refs_unify_local_origin_and_origin_only_branches() {
        let repo = init_repo();
        let sha = commit_file(repo.path(), "file.txt", "hello\n", "initial");
        run_git(
            repo.path(),
            &["update-ref", "refs/remotes/origin/main", &sha],
        );
        run_git(
            repo.path(),
            &["update-ref", "refs/remotes/origin/review", &sha],
        );
        run_git(
            repo.path(),
            &[
                "symbolic-ref",
                "refs/remotes/origin/HEAD",
                "refs/remotes/origin/main",
            ],
        );

        let refs =
            get_branch_refs(repo.path().to_string_lossy().to_string()).expect("refs should load");
        let main = branch_ref(&refs, "main");
        let review = branch_ref(&refs, "review");

        assert_eq!(main.local_name.as_deref(), Some("main"));
        assert_eq!(main.origin_name.as_deref(), Some("origin/main"));
        assert_eq!(main.presence, BranchRefPresence::LocalOrigin);
        assert_eq!(main.ahead_count, Some(0));
        assert_eq!(main.behind_count, Some(0));
        assert_eq!(review.local_name, None);
        assert_eq!(review.origin_name.as_deref(), Some("origin/review"));
        assert_eq!(review.presence, BranchRefPresence::Origin);
        assert!(refs.iter().all(|branch_ref| branch_ref.name != "HEAD"));
    }

    #[test]
    fn branch_refs_report_diverged_ahead_and_behind_counts() {
        let repo = init_repo();
        let base_sha = commit_file(repo.path(), "base.txt", "base\n", "base");
        run_git(repo.path(), &["checkout", "-b", "feature"]);
        commit_file(repo.path(), "local.txt", "local\n", "local");
        run_git(repo.path(), &["checkout", "-b", "remote-work", &base_sha]);
        let remote_sha = commit_file(repo.path(), "remote.txt", "remote\n", "remote");
        run_git(
            repo.path(),
            &["update-ref", "refs/remotes/origin/feature", &remote_sha],
        );
        run_git(repo.path(), &["checkout", "feature"]);
        run_git(repo.path(), &["branch", "-D", "remote-work"]);

        let refs =
            get_branch_refs(repo.path().to_string_lossy().to_string()).expect("refs should load");
        let feature = branch_ref(&refs, "feature");

        assert_eq!(feature.presence, BranchRefPresence::LocalOrigin);
        assert_eq!(feature.local_name.as_deref(), Some("feature"));
        assert_eq!(feature.origin_name.as_deref(), Some("origin/feature"));
        assert_eq!(feature.ahead_count, Some(1));
        assert_eq!(feature.behind_count, Some(1));
        assert_ne!(feature.local_target_id, feature.origin_target_id);
    }

    #[test]
    fn branch_refs_report_ahead_only_and_behind_only_counts() {
        let repo = init_repo();
        let base_sha = commit_file(repo.path(), "base.txt", "base\n", "base");
        run_git(
            repo.path(),
            &["update-ref", "refs/remotes/origin/ahead", &base_sha],
        );
        run_git(repo.path(), &["checkout", "-b", "ahead", &base_sha]);
        commit_file(repo.path(), "ahead.txt", "ahead\n", "ahead");

        run_git(repo.path(), &["checkout", "main"]);
        run_git(repo.path(), &["branch", "behind", &base_sha]);
        run_git(repo.path(), &["checkout", "-b", "remote-work", &base_sha]);
        let remote_sha = commit_file(repo.path(), "behind.txt", "behind\n", "behind");
        run_git(
            repo.path(),
            &["update-ref", "refs/remotes/origin/behind", &remote_sha],
        );
        run_git(repo.path(), &["checkout", "main"]);
        run_git(repo.path(), &["branch", "-D", "remote-work"]);

        let refs =
            get_branch_refs(repo.path().to_string_lossy().to_string()).expect("refs should load");
        let ahead = branch_ref(&refs, "ahead");
        let behind = branch_ref(&refs, "behind");

        assert_eq!(ahead.ahead_count, Some(1));
        assert_eq!(ahead.behind_count, Some(0));
        assert_eq!(behind.ahead_count, Some(0));
        assert_eq!(behind.behind_count, Some(1));
    }

    #[test]
    fn origin_logical_name_accepts_short_and_full_remote_ref_names() {
        assert_eq!(origin_logical_name("origin/main"), Some("main"));
        assert_eq!(
            origin_logical_name("refs/remotes/origin/main"),
            Some("main")
        );
        assert_eq!(origin_logical_name("origin/HEAD"), None);
        assert_eq!(origin_logical_name("refs/remotes/origin/HEAD"), None);
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

    fn branch_ref<'a>(refs: &'a [GitBranchRef], name: &str) -> &'a GitBranchRef {
        refs.iter()
            .find(|branch_ref| branch_ref.name == name)
            .expect("branch ref should exist")
    }
}
