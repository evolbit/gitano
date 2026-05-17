use super::helpers::{parse_stash_list, run_git};
use crate::git::types::{ChangeType, GitStashEntry, StashFileChange};
use std::collections::HashMap;

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
