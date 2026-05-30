use crate::git::repository_state::ensure_repository_has_commits;
use git2::{Oid, Repository};
use std::process::Command;

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
    match mode.unwrap_or("push-branch") {
        "push-branch" => Ok(PushMode::Branch),
        "push-branch-and-tags" => Ok(PushMode::BranchAndTags),
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

#[tauri::command]
pub async fn git_push(path: String, mode: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_repository_has_commits(&path, "git push")?;
        match parse_push_mode(mode.as_deref())? {
            PushMode::Branch => run_git_status(&path, &["push"], "git push"),
            PushMode::BranchAndTags => {
                run_git_status(&path, &["push"], "git push")?;
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
}
