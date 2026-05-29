use super::graph::{build_zed_style_commit_graph, parse_raw_commit_rows, PreparedCommitGraph};
use crate::git::repository_state::repository_has_commits;
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

    let all_commits = {
        let mut cache = COMMIT_LIST_CACHE.lock().unwrap();
        if force_refresh {
            let repo_prefix = format!("{}::", path);
            cache.retain(|k, _| !k.starts_with(&repo_prefix));
        }
        cache.get(&cache_key).cloned()
    };

    let all_commits = match all_commits {
        Some(all_commits) => all_commits,
        None => {
            let all_commits = collect_commit_rows_with_graph(&path, history_mode)?;
            let mut cache = COMMIT_LIST_CACHE.lock().unwrap();
            cache.insert(cache_key.clone(), all_commits.clone());
            all_commits
        }
    };

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

pub(super) fn collect_commit_rows_with_graph(
    path: &str,
    history_mode: CommitHistoryMode,
) -> Result<Vec<CommitListItem>, String> {
    Ok(collect_prepared_commit_graph(path, history_mode)?.into_commit_rows_with_graph_segments())
}

pub(super) fn collect_prepared_commit_graph(
    path: &str,
    history_mode: CommitHistoryMode,
) -> Result<PreparedCommitGraph, String> {
    if !repository_has_commits(path)? {
        return Ok(PreparedCommitGraph::empty());
    }

    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(path)
        .arg("log")
        .arg("--branches")
        .arg("--remotes")
        .arg("--tags")
        .arg("HEAD")
        .arg("--date-order")
        .arg("--color=never")
        .arg("--no-abbrev-commit")
        .arg("--pretty=format:%H%x1f%P%x1f%at%x1f%an%x1f%ae%x1f%x1f%s");

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
    let refs_by_target = collect_ref_labels_by_target(path)?;
    let mut graph = build_zed_style_commit_graph(raw_commits);

    for commit in graph.commits_mut() {
        if let Some(refs) = refs_by_target.get(&commit.sha) {
            commit.refs = refs.clone();
        }
    }

    Ok(graph)
}

fn collect_ref_labels_by_target(path: &str) -> Result<HashMap<String, Vec<String>>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .arg("for-each-ref")
        .arg("--format=%(refname)%09%(refname:short)%09%(*objectname)%09%(objectname)")
        .arg("refs/heads")
        .arg("refs/remotes")
        .arg("refs/tags")
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Failed to run git for-each-ref command".to_string()
        } else {
            stderr
        });
    }

    let mut refs_by_target: HashMap<String, Vec<String>> = HashMap::new();

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let mut fields = line.splitn(4, '\t');
        let ref_name = fields.next().unwrap_or("");
        let short_name = fields.next().unwrap_or("");
        let peeled_object = fields.next().unwrap_or("");
        let object = fields.next().unwrap_or("");
        let target = if peeled_object.is_empty() {
            object
        } else {
            peeled_object
        };

        if target.is_empty() || short_name.is_empty() {
            continue;
        }

        let label = if ref_name.starts_with("refs/tags/") {
            format!("tag: {short_name}")
        } else {
            short_name.to_string()
        };

        let labels = refs_by_target.entry(target.to_string()).or_default();
        if !labels.contains(&label) {
            labels.push(label);
        }
    }

    for labels in refs_by_target.values_mut() {
        labels.sort();
    }

    Ok(refs_by_target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};

    #[test]
    fn returns_empty_page_for_unborn_repository() {
        let repo = init_repo();

        let page = get_commits_list_paginated(
            repo.path().to_string_lossy().to_string(),
            None,
            0,
            50,
            Some(true),
        )
        .expect("unborn history should load");

        assert!(page.commits.is_empty());
        assert!(!page.has_more);
    }

    #[test]
    fn prepared_history_includes_ref_labels_from_for_each_ref() {
        let repo = init_repo();
        let sha = commit_file(repo.path(), "README.md", "hello", "Initial commit");
        run_git(repo.path(), &["tag", "v1.0.0", &sha]);
        run_git(
            repo.path(),
            &["update-ref", "refs/remotes/origin/main", &sha],
        );

        let graph = collect_prepared_commit_graph(
            &repo.path().to_string_lossy(),
            CommitHistoryMode::GitLog,
        )
        .expect("prepared history should load");

        let refs = &graph.commits()[0].refs;
        assert!(refs.contains(&"main".to_string()));
        assert!(refs.contains(&"origin/main".to_string()));
        assert!(refs.contains(&"tag: v1.0.0".to_string()));
    }
}
