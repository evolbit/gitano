use crate::git::repository_state::ensure_repository_has_commits;
use git2::{Oid, Repository};
use std::process::Command;

const DEFAULT_PUSH_MODE: &str = "push-branch";
const PUSH_BRANCH_AND_TAGS_MODE: &str = "push-branch-and-tags";
const DEFAULT_REMOTE_NAME: &str = "origin";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PushMode {
    Branch,
    BranchAndTags,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FetchMode {
    AllWithTags,
    AllWithTagsAndPrune,
}

fn parse_push_mode(mode: Option<&str>) -> Result<PushMode, String> {
    match mode.unwrap_or(DEFAULT_PUSH_MODE) {
        DEFAULT_PUSH_MODE => Ok(PushMode::Branch),
        PUSH_BRANCH_AND_TAGS_MODE => Ok(PushMode::BranchAndTags),
        other => Err(format!("Unsupported push mode: {}", other)),
    }
}

fn parse_fetch_mode(mode: Option<&str>) -> Result<FetchMode, String> {
    match mode.unwrap_or("fetch-all") {
        "fetch-all" => Ok(FetchMode::AllWithTags),
        "fetch-all-prune" => Ok(FetchMode::AllWithTagsAndPrune),
        other => Err(format!("Unsupported fetch mode: {}", other)),
    }
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

fn parse_remote_head_line(line: &str) -> Option<(String, Oid)> {
    let mut parts = line.split_whitespace();
    let oid = Oid::from_str(parts.next()?).ok()?;
    let ref_name = parts.next()?;
    let branch_name = ref_name.strip_prefix("refs/heads/")?;

    if branch_name.is_empty() {
        return None;
    }

    Some((branch_name.to_string(), oid))
}

fn remote_refs_changed_from_ls_remote_output(repo: &Repository, output: &str) -> bool {
    output
        .lines()
        .filter_map(parse_remote_head_line)
        .any(|(branch_name, remote_oid)| {
            let local_ref_name = format!("refs/remotes/origin/{branch_name}");
            repo.find_reference(&local_ref_name)
                .ok()
                .and_then(|reference| reference.target())
                != Some(remote_oid)
        })
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

fn current_branch(path: &str) -> Result<String, String> {
    let branch = run_git_output(
        path,
        &["branch", "--show-current"],
        "git branch --show-current",
    )?;
    if branch.is_empty() {
        return Err("git push requires a checked-out local branch.".to_string());
    }
    Ok(branch)
}

fn current_branch_has_upstream(path: &str) -> Result<bool, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args([
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    Ok(output.status.success())
}

fn push_current_branch(path: &str) -> Result<(), String> {
    if current_branch_has_upstream(path)? {
        return run_git_status(path, &["push"], "git push");
    }

    let branch = current_branch(path)?;
    run_git_status(
        path,
        &["push", "--set-upstream", DEFAULT_REMOTE_NAME, &branch],
        "git push --set-upstream",
    )
}

#[tauri::command]
pub async fn git_push(path: String, mode: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git push")?;
        match parse_push_mode(mode.as_deref())? {
            PushMode::Branch => push_current_branch(&path),
            PushMode::BranchAndTags => {
                push_current_branch(&path)?;
                run_git_status(&path, &["push", "--tags"], "git push --tags").map_err(|error| {
                    format!(
                        "Branch push completed, but tag publishing failed: {}",
                        error
                    )
                })
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_fetch(path: String, mode: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mode = parse_fetch_mode(mode.as_deref())?;
        let mut args = vec!["fetch", "--all", "--tags"];
        if mode == FetchMode::AllWithTagsAndPrune {
            args.extend(["--prune", "--prune-tags"]);
        }

        let output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .args(args)
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "git fetch failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_remote_refs_changed(path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&path).map_err(|e| e.to_string())?;
        let output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .args(["ls-remote", "--heads", "origin"])
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(format!(
                "git ls-remote --heads origin failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(remote_refs_changed_from_ls_remote_output(
            &repo,
            &String::from_utf8_lossy(&output.stdout),
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_pull(path: String, strategy: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("git");
        cmd.arg("-C").arg(&path).arg("pull");

        match strategy.as_str() {
            "pull-ff-only" => {
                cmd.arg("--ff-only");
            }
            "pull-rebase" => {
                cmd.arg("--rebase");
            }
            "pull-ff-if-possible" => {}
            other => {
                return Err(format!("Unsupported pull strategy: {}", other));
            }
        }

        ensure_repository_has_commits(&path, "git pull")?;

        let output = cmd.output().map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "git pull failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};
    use std::path::Path;
    use tempfile::{tempdir, TempDir};

    fn git_stdout(repo_path: &Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .args(args)
            .output()
            .expect("git command should run");

        assert!(
            output.status.success(),
            "git {:?} failed\nstdout: {}\nstderr: {}",
            args,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );

        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    fn add_bare_origin(repo_path: &Path) -> TempDir {
        let remote = tempdir().expect("bare remote should be created");
        run_git(remote.path(), &["init", "--bare"]);
        let remote_path = remote.path().to_string_lossy().to_string();
        run_git(
            repo_path,
            &["remote", "add", DEFAULT_REMOTE_NAME, &remote_path],
        );
        remote
    }

    #[test]
    fn parse_push_mode_defaults_to_branch_push() {
        assert_eq!(parse_push_mode(None), Ok(PushMode::Branch));
    }

    #[test]
    fn parse_push_mode_accepts_branch_and_tags() {
        assert_eq!(
            parse_push_mode(Some("push-branch-and-tags")),
            Ok(PushMode::BranchAndTags)
        );
    }

    #[test]
    fn parse_push_mode_rejects_unknown_modes() {
        assert_eq!(
            parse_push_mode(Some("push-prune-tags")),
            Err("Unsupported push mode: push-prune-tags".to_string())
        );
    }

    #[test]
    fn parse_fetch_mode_defaults_to_fetch_all_with_tags() {
        assert_eq!(parse_fetch_mode(None), Ok(FetchMode::AllWithTags));
    }

    #[test]
    fn parse_fetch_mode_accepts_prune_mode() {
        assert_eq!(
            parse_fetch_mode(Some("fetch-all-prune")),
            Ok(FetchMode::AllWithTagsAndPrune),
        );
    }

    #[test]
    fn parse_fetch_mode_rejects_unknown_modes() {
        assert_eq!(
            parse_fetch_mode(Some("fetch-local-only")),
            Err("Unsupported fetch mode: fetch-local-only".to_string())
        );
    }

    #[test]
    fn parse_remote_head_line_reads_origin_head_output() {
        let oid = "d1d84dd0ad924cbc7d8284724c2df8945e148802";

        assert_eq!(
            parse_remote_head_line(&format!("{oid}\trefs/heads/main")),
            Some((
                "main".to_string(),
                Oid::from_str(oid).expect("test oid should parse")
            ))
        );
        assert_eq!(parse_remote_head_line(&format!("{oid}\tHEAD")), None);
        assert_eq!(parse_remote_head_line("not-an-oid\trefs/heads/main"), None);
    }

    #[test]
    fn remote_refs_changed_from_ls_remote_output_detects_moved_origin_branch() {
        let repo = init_repo();
        let local_sha = commit_file(repo.path(), "local.txt", "local\n", "local");
        run_git(
            repo.path(),
            &["update-ref", "refs/remotes/origin/main", &local_sha],
        );
        let remote_sha = commit_file(repo.path(), "remote.txt", "remote\n", "remote");
        let output = format!("{remote_sha}\trefs/heads/main\n");
        let repository = Repository::open(repo.path()).expect("repo should open");

        assert!(remote_refs_changed_from_ls_remote_output(
            &repository,
            &output
        ));
    }

    #[test]
    fn remote_refs_changed_from_ls_remote_output_ignores_matching_origin_branch() {
        let repo = init_repo();
        let sha = commit_file(repo.path(), "file.txt", "content\n", "commit");
        run_git(
            repo.path(),
            &["update-ref", "refs/remotes/origin/main", &sha],
        );
        let output = format!("{sha}\trefs/heads/main\n");
        let repository = Repository::open(repo.path()).expect("repo should open");

        assert!(!remote_refs_changed_from_ls_remote_output(
            &repository,
            &output
        ));
    }

    #[test]
    fn rejects_unknown_pull_strategies_before_running_git() {
        let result = tauri::async_runtime::block_on(git_pull(
            "/repo".to_string(),
            "pull-octopus".to_string(),
        ));

        assert_eq!(
            result,
            Err("Unsupported pull strategy: pull-octopus".to_string())
        );
    }

    #[test]
    fn branch_push_sets_upstream_for_current_branch_without_tracking() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["checkout", "-b", "feature/new-branch"]);
        let _remote = add_bare_origin(repo.path());

        tauri::async_runtime::block_on(git_push(
            repo.path().to_string_lossy().to_string(),
            Some(DEFAULT_PUSH_MODE.to_string()),
        ))
        .expect("first branch push should set upstream");

        let upstream = git_stdout(
            repo.path(),
            &[
                "rev-parse",
                "--abbrev-ref",
                "--symbolic-full-name",
                "@{upstream}",
            ],
        );
        let remote_ref = git_stdout(
            repo.path(),
            &[
                "ls-remote",
                "--heads",
                DEFAULT_REMOTE_NAME,
                "feature/new-branch",
            ],
        );

        assert_eq!(upstream, "origin/feature/new-branch");
        assert!(remote_ref.contains("refs/heads/feature/new-branch"));
    }

    #[test]
    fn branch_and_tags_push_sets_upstream_before_publishing_tags() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["checkout", "-b", "feature/with-tags"]);
        run_git(repo.path(), &["tag", "v1.0.0"]);
        let _remote = add_bare_origin(repo.path());

        tauri::async_runtime::block_on(git_push(
            repo.path().to_string_lossy().to_string(),
            Some(PUSH_BRANCH_AND_TAGS_MODE.to_string()),
        ))
        .expect("first branch and tags push should set upstream and publish tags");

        let upstream = git_stdout(
            repo.path(),
            &[
                "rev-parse",
                "--abbrev-ref",
                "--symbolic-full-name",
                "@{upstream}",
            ],
        );
        let remote_tag = git_stdout(
            repo.path(),
            &["ls-remote", "--tags", DEFAULT_REMOTE_NAME, "v1.0.0"],
        );

        assert_eq!(upstream, "origin/feature/with-tags");
        assert!(remote_tag.contains("refs/tags/v1.0.0"));
    }
}
