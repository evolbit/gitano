use super::graph::{build_zed_style_commit_rows, parse_raw_commit_rows};
use crate::git::types::*;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use tauri::command;

static COMMIT_LIST_CACHE: Lazy<Mutex<HashMap<String, Vec<CommitListItem>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[command]
pub fn get_commits_list_paginated(
    path: String,
    history_mode: Option<CommitHistoryMode>,
    offset: usize,
    limit: usize,
    force_refresh: Option<bool>,
) -> Result<CommitListPage, String> {
    let history_mode = history_mode.unwrap_or(CommitHistoryMode::GitLog);
    let force_refresh = force_refresh.unwrap_or(false);
    let cache_key = format!("{}::{:?}", path, history_mode);

    let mut cache = COMMIT_LIST_CACHE.lock().unwrap();
    if force_refresh {
        let repo_prefix = format!("{}::", path);
        cache.retain(|k, _| !k.starts_with(&repo_prefix));
    }

    if force_refresh || !cache.contains_key(&cache_key) {
        let all_commits = collect_commit_rows_with_graph(&path, history_mode)?;
        cache.insert(cache_key.clone(), all_commits);
    }
    let all_commits = cache.get(&cache_key).cloned().unwrap_or_default();
    drop(cache);

    if all_commits.is_empty() || offset >= all_commits.len() {
        return Ok(CommitListPage {
            commits: Vec::new(),
            has_more: false,
        });
    }

    let safe_limit = if limit == 0 { 50 } else { limit };
    let end = offset.saturating_add(safe_limit).min(all_commits.len());
    let has_more = end < all_commits.len();
    let commits = all_commits[offset..end].to_vec();

    Ok(CommitListPage { commits, has_more })
}

fn collect_commit_rows_with_graph(
    path: &str,
    history_mode: CommitHistoryMode,
) -> Result<Vec<CommitListItem>, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(path)
        .arg("log")
        .arg("--branches")
        .arg("--remotes")
        .arg("--tags")
        .arg("HEAD")
        .arg("--decorate=short")
        .arg("--date-order")
        .arg("--color=never")
        .arg("--no-abbrev-commit")
        .arg("--pretty=format:%H%x1f%P%x1f%at%x1f%an%x1f%ae%x1f%D%x1f%s");

    if history_mode == CommitHistoryMode::FirstParent {
        cmd.arg("--first-parent");
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Failed to run git log command".to_string()
        } else {
            stderr
        });
    }

    let raw_commits = parse_raw_commit_rows(&String::from_utf8_lossy(&output.stdout));
    Ok(build_zed_style_commit_rows(raw_commits))
}
