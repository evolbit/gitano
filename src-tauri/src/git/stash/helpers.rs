use crate::git::types::GitStashEntry;
use std::process::Command;

pub(super) fn run_git(path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub(super) fn run_git_status(path: &str, args: &[&str]) -> Result<(), String> {
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
        "git {} failed: {}",
        args.join(" "),
        String::from_utf8_lossy(&output.stderr)
    ))
}

pub(super) fn resolve_stash_message(path: &str, message: Option<String>) -> Result<String, String> {
    if let Some(value) = message {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    let branch = run_git(path, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();
    Ok(format!("WIP-{}", branch))
}

pub(super) fn parse_stash_list(path: &str) -> Result<Vec<GitStashEntry>, String> {
    let raw = run_git(path, &["stash", "list", "--format=%gd%x1f%H%x1f%ct%x1f%gs"])?;

    let mut stashes = Vec::new();
    for line in raw.lines() {
        let parts: Vec<&str> = line.split('\u{1f}').collect();
        if parts.len() != 4 {
            continue;
        }
        let date = parts[2].parse::<i64>().unwrap_or(0);
        stashes.push(GitStashEntry {
            selector: parts[0].to_string(),
            hash: parts[1].to_string(),
            date,
            message: parts[3].to_string(),
        });
    }
    Ok(stashes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo};

    #[test]
    fn uses_trimmed_custom_messages() {
        let message = resolve_stash_message("/repo", Some("  WIP custom  ".to_string()))
            .expect("custom messages should not need git");

        assert_eq!(message, "WIP custom");
    }

    #[test]
    fn derives_default_message_from_current_branch() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");

        let message =
            resolve_stash_message(&repo.path().to_string_lossy(), None).expect("branch exists");

        assert_eq!(message, "WIP-main");
    }
}
