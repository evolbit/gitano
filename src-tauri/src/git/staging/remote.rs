use crate::git::repository_state::ensure_repository_has_commits;
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
