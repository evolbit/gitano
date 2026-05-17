use crate::git::types::{RepositoryHeadStatus, RepositoryState};
use git2::{ErrorCode, Repository};
use std::fs;

const INITIAL_COMMIT_REQUIRED: &str = "Create the initial commit before trying again.";

pub fn load_repository_state(path: &str) -> Result<RepositoryState, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    resolve_repository_state(path, &repo)
}

pub fn repository_has_commits(path: &str) -> Result<bool, String> {
    load_repository_state(path).map(|state| state.has_commits)
}

pub fn ensure_repository_has_commits(path: &str, action: &str) -> Result<(), String> {
    if repository_has_commits(path)? {
        return Ok(());
    }

    Err(format!(
        "{action} requires an initial commit. {INITIAL_COMMIT_REQUIRED}"
    ))
}

pub fn is_unborn_head_error(error: &git2::Error) -> bool {
    error.code() == ErrorCode::UnbornBranch || error.code() == ErrorCode::NotFound
}

pub fn resolve_repository_state(path: &str, repo: &Repository) -> Result<RepositoryState, String> {
    let (head_status, branch, has_commits) = match repo.head() {
        Ok(head) if head.is_branch() => {
            let branch = head.shorthand().map(ToString::to_string);
            let has_commits = head.target().is_some();
            let status = if has_commits {
                RepositoryHeadStatus::Normal
            } else {
                RepositoryHeadStatus::Unknown
            };
            (status, branch, has_commits)
        }
        Ok(head) if head.target().is_some() => (RepositoryHeadStatus::Detached, None, true),
        Ok(head) => (
            RepositoryHeadStatus::Unknown,
            head.shorthand().map(ToString::to_string),
            false,
        ),
        Err(error) if is_unborn_head_error(&error) => (
            RepositoryHeadStatus::Unborn,
            unborn_branch_name(repo).or_else(|| fallback_symbolic_head(repo)),
            false,
        ),
        Err(error) => return Err(error.to_string()),
    };

    let is_unborn = head_status == RepositoryHeadStatus::Unborn;
    let is_detached = head_status == RepositoryHeadStatus::Detached;

    Ok(RepositoryState {
        path: path.to_string(),
        is_valid: true,
        branch,
        head_status,
        has_commits,
        is_unborn,
        is_detached,
    })
}

fn unborn_branch_name(repo: &Repository) -> Option<String> {
    repo.find_reference("HEAD")
        .ok()
        .and_then(|head| head.symbolic_target().map(branch_name_from_ref))
}

fn fallback_symbolic_head(repo: &Repository) -> Option<String> {
    let head_path = repo.path().join("HEAD");
    let raw = fs::read_to_string(head_path).ok()?;
    let target = raw.trim().strip_prefix("ref: ")?.trim();
    Some(branch_name_from_ref(target))
}

fn branch_name_from_ref(ref_name: &str) -> String {
    ref_name
        .strip_prefix("refs/heads/")
        .unwrap_or(ref_name)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};
    use crate::git::{git_commit, git_stage_all};

    mod load_repository_state {
        use super::*;

        #[test]
        fn reports_unborn_repositories_as_valid_without_commits() {
            let repo = init_repo();

            let state = load_repository_state(&repo.path().to_string_lossy())
                .expect("unborn repo should be valid");

            assert_eq!(state.head_status, RepositoryHeadStatus::Unborn);
            assert_eq!(state.branch.as_deref(), Some("main"));
            assert!(!state.has_commits);
            assert!(state.is_unborn);
        }

        #[test]
        fn reports_normal_branch_repositories_with_commits() {
            let repo = init_repo();
            commit_file(repo.path(), "file.txt", "hello\n", "initial");

            let state = load_repository_state(&repo.path().to_string_lossy())
                .expect("normal repo should be valid");

            assert_eq!(state.head_status, RepositoryHeadStatus::Normal);
            assert_eq!(state.branch.as_deref(), Some("main"));
            assert!(state.has_commits);
            assert!(!state.is_unborn);
        }

        #[test]
        fn reports_detached_head_repositories() {
            let repo = init_repo();
            let sha = commit_file(repo.path(), "file.txt", "hello\n", "initial");
            run_git(repo.path(), &["checkout", "--detach", &sha]);

            let state = load_repository_state(&repo.path().to_string_lossy())
                .expect("detached repo should be valid");

            assert_eq!(state.head_status, RepositoryHeadStatus::Detached);
            assert_eq!(state.branch, None);
            assert!(state.has_commits);
            assert!(state.is_detached);
        }

        #[test]
        fn rejects_invalid_repository_paths() {
            let error = load_repository_state("/definitely/not/a/repo")
                .expect_err("invalid path should fail");

            assert!(!error.is_empty());
        }

        #[test]
        fn transitions_to_normal_state_after_first_commit() {
            let repo = init_repo();
            crate::git::test_support::write_file(repo.path(), "file.txt", "hello\n");
            git_stage_all(repo.path().to_string_lossy().to_string())
                .expect("stage all should work before first commit");

            git_commit(
                repo.path().to_string_lossy().to_string(),
                "initial".to_string(),
                false,
            )
            .expect("first commit should succeed");

            let state = load_repository_state(&repo.path().to_string_lossy())
                .expect("repository should reload after first commit");

            assert_eq!(state.head_status, RepositoryHeadStatus::Normal);
            assert!(state.has_commits);
        }
    }
}
