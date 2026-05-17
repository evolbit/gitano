use crate::git::diff::get_commit_file_diff;
use crate::git::types::{ChangeType, DiffHunk, GitStashEntry, StashFileChange};
use std::collections::HashMap;
use std::io::Write;
use std::process::{Command, Stdio};

fn run_git(path: &str, args: &[&str]) -> Result<String, String> {
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

fn run_git_status(path: &str, args: &[&str]) -> Result<(), String> {
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

fn resolve_stash_message(path: &str, message: Option<String>) -> Result<String, String> {
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

fn parse_stash_list(path: &str) -> Result<Vec<GitStashEntry>, String> {
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

#[tauri::command]
pub fn git_stash_all(path: String, message: Option<String>) -> Result<(), String> {
    let stash_message = resolve_stash_message(&path, message)?;
    run_git_status(&path, &["stash", "push", "-u", "-m", &stash_message])
}

#[tauri::command]
pub fn git_stash_selected(
    path: String,
    file_paths: Vec<String>,
    message: Option<String>,
) -> Result<(), String> {
    if file_paths.is_empty() {
        return Err("No files selected for stash.".to_string());
    }

    let stash_message = resolve_stash_message(&path, message)?;
    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(&path)
        .arg("stash")
        .arg("push")
        .arg("-u")
        .arg("-m")
        .arg(stash_message)
        .arg("--");

    for file_path in &file_paths {
        cmd.arg(file_path);
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git stash push (selected files) failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_stash_pop(path: String, stash_ref: Option<String>) -> Result<(), String> {
    if let Some(stash_ref) = stash_ref {
        run_git_status(&path, &["stash", "pop", &stash_ref])
    } else {
        run_git_status(&path, &["stash", "pop"])
    }
}

#[tauri::command]
pub fn git_stash_apply(path: String, stash_ref: String) -> Result<(), String> {
    run_git_status(&path, &["stash", "apply", &stash_ref])
}

#[tauri::command]
pub fn git_stash_drop(path: String, stash_ref: String) -> Result<(), String> {
    run_git_status(&path, &["stash", "drop", &stash_ref])
}

#[tauri::command]
pub fn git_stash_list(path: String) -> Result<Vec<GitStashEntry>, String> {
    parse_stash_list(&path)
}

#[tauri::command]
pub fn git_stash_files(path: String, stash_ref: String) -> Result<Vec<StashFileChange>, String> {
    let output = run_git(
        &path,
        &[
            "stash",
            "show",
            "--numstat",
            "--format=",
            "--include-untracked",
            &stash_ref,
        ],
    )?;

    let status_output = run_git(
        &path,
        &[
            "stash",
            "show",
            "--name-status",
            "--format=",
            "--include-untracked",
            &stash_ref,
        ],
    )?;

    let mut status_by_path: HashMap<String, ChangeType> = HashMap::new();
    for line in status_output.lines() {
        let mut cols = line.split_whitespace();
        let status = cols.next().unwrap_or("M");
        let path = cols.collect::<Vec<&str>>().join(" ");
        if path.is_empty() {
            continue;
        }
        let mapped = match status.chars().next().unwrap_or('M') {
            'A' => ChangeType::Added,
            'D' => ChangeType::Deleted,
            'R' => ChangeType::Renamed,
            'C' => ChangeType::Copied,
            'T' => ChangeType::TypeChanged,
            _ => ChangeType::Modified,
        };
        status_by_path.insert(path, mapped);
    }

    let mut files = Vec::new();
    for line in output.lines() {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 3 {
            continue;
        }

        let insertions = cols[0].parse::<u32>().unwrap_or(0);
        let deletions = cols[1].parse::<u32>().unwrap_or(0);
        let path = cols[2].to_string();
        let status = status_by_path
            .get(&path)
            .cloned()
            .unwrap_or(ChangeType::Modified);

        files.push(StashFileChange {
            path,
            status,
            insertions,
            deletions,
        });
    }

    Ok(files)
}

#[tauri::command]
pub fn git_stash_apply_files(
    path: String,
    stash_ref: String,
    file_paths: Vec<String>,
) -> Result<(), String> {
    if file_paths.is_empty() {
        return Err("No stash files selected for apply.".to_string());
    }

    let mut show_cmd = Command::new("git");
    show_cmd
        .arg("-C")
        .arg(&path)
        .arg("stash")
        .arg("show")
        .arg("-p")
        .arg("--include-untracked")
        .arg(&stash_ref)
        .arg("--");

    for file_path in &file_paths {
        show_cmd.arg(file_path);
    }

    let show_output = show_cmd.output().map_err(|e| e.to_string())?;
    if !show_output.status.success() {
        return Err(format!(
            "git stash show failed: {}",
            String::from_utf8_lossy(&show_output.stderr)
        ));
    }

    if show_output.stdout.is_empty() {
        return Ok(());
    }

    let mut apply_cmd = Command::new("git");
    apply_cmd
        .arg("-C")
        .arg(&path)
        .arg("apply")
        .arg("--whitespace=nowarn")
        .arg("--recount")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = apply_cmd.spawn().map_err(|e| e.to_string())?;
    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(&show_output.stdout)
            .map_err(|e| e.to_string())?;
    }

    let apply_output = child.wait_with_output().map_err(|e| e.to_string())?;
    if apply_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git apply selected stash files failed: {}",
        String::from_utf8_lossy(&apply_output.stderr)
    ))
}

#[tauri::command]
pub fn git_stash_edit_message(
    path: String,
    stash_ref: String,
    new_message: String,
) -> Result<(), String> {
    let trimmed = new_message.trim();
    if trimmed.is_empty() {
        return Err("Stash message cannot be empty.".to_string());
    }

    let old_hash = run_git(&path, &["rev-parse", &stash_ref])?
        .trim()
        .to_string();
    run_git_status(&path, &["stash", "drop", &stash_ref])?;
    run_git_status(&path, &["stash", "store", "-m", trimmed, &old_hash])?;

    Ok(())
}

#[tauri::command]
pub fn get_stash_file_diff(
    path: String,
    sha: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    get_commit_file_diff(path, sha, file_path, context)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, write_file};

    mod resolve_stash_message {
        use super::*;

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

    mod git_stash_selected {
        use super::*;

        #[test]
        fn rejects_empty_file_selections_before_running_git() {
            let result = git_stash_selected("/repo".to_string(), Vec::new(), None);

            assert_eq!(result, Err("No files selected for stash.".to_string()));
        }
    }

    mod git_stash_apply_files {
        use super::*;

        #[test]
        fn rejects_empty_file_selections_before_reading_the_stash() {
            let result =
                git_stash_apply_files("/repo".to_string(), "stash@{0}".to_string(), Vec::new());

            assert_eq!(
                result,
                Err("No stash files selected for apply.".to_string())
            );
        }
    }

    mod git_stash_all {
        use super::*;

        #[test]
        fn creates_a_stash_with_a_custom_message() {
            let repo = init_repo();
            commit_file(repo.path(), "file.txt", "one\n", "initial");
            write_file(repo.path(), "file.txt", "one\ntwo\n");

            git_stash_all(
                repo.path().to_string_lossy().to_string(),
                Some("custom stash".to_string()),
            )
            .expect("stash should be created");

            let stashes =
                git_stash_list(repo.path().to_string_lossy().to_string()).expect("stash exists");
            assert_eq!(stashes.len(), 1);
            assert!(stashes[0].message.contains("custom stash"));
        }
    }

    mod git_stash_edit_message {
        use super::*;

        #[test]
        fn rejects_empty_replacement_messages_before_running_git() {
            let result = git_stash_edit_message(
                "/repo".to_string(),
                "stash@{0}".to_string(),
                " ".to_string(),
            );

            assert_eq!(result, Err("Stash message cannot be empty.".to_string()));
        }
    }
}
