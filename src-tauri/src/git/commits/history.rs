use super::graph::PreparedCommitGraph;
use super::list::collect_prepared_commit_graph;
use crate::git::types::*;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::async_runtime::spawn_blocking;

const DEFAULT_HISTORY_WINDOW_SIZE: usize = 2_000;
const MAX_HISTORY_WINDOW_SIZE: usize = 10_000;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct CommitHistoryCacheKey {
    path: String,
    history_mode: CommitHistoryMode,
}

#[derive(Debug, Clone)]
enum CommitHistoryCacheEntry {
    Loading { generation: u64 },
    Ready { history: Arc<PreparedCommitGraph> },
    Error { message: String },
}

#[derive(Debug, Default)]
struct CommitHistoryCache {
    entries: HashMap<CommitHistoryCacheKey, CommitHistoryCacheEntry>,
    next_generation: u64,
}

impl CommitHistoryCache {
    fn next_generation(&mut self) -> u64 {
        self.next_generation = self.next_generation.saturating_add(1);
        self.next_generation
    }
}

#[derive(Debug, PartialEq, Eq)]
enum PrepareHistoryDecision {
    Return(CommitHistoryStatusResponse),
    Spawn { generation: u64 },
}

static COMMIT_HISTORY_CACHE: Lazy<Mutex<CommitHistoryCache>> =
    Lazy::new(|| Mutex::new(CommitHistoryCache::default()));

#[tauri::command]
pub async fn prepare_commit_history(
    path: String,
    history_mode: Option<CommitHistoryMode>,
    force_refresh: Option<bool>,
) -> Result<CommitHistoryStatusResponse, String> {
    let history_mode = history_mode.unwrap_or(CommitHistoryMode::GitLog);
    let force_refresh = force_refresh.unwrap_or(false);
    let key = CommitHistoryCacheKey { path, history_mode };

    let decision = {
        let mut cache = COMMIT_HISTORY_CACHE.lock().map_err(|e| e.to_string())?;
        begin_prepare_history(&mut cache, key.clone(), force_refresh)
    };

    match decision {
        PrepareHistoryDecision::Return(response) => Ok(response),
        PrepareHistoryDecision::Spawn { generation } => {
            spawn_history_job(key, generation);
            Ok(CommitHistoryStatusResponse {
                status: CommitHistoryCacheStatus::Loading,
                total_count: 0,
                error: None,
            })
        }
    }
}

#[tauri::command]
pub fn get_commit_history_window(
    path: String,
    history_mode: Option<CommitHistoryMode>,
    offset: Option<usize>,
    limit: Option<usize>,
    anchor_sha: Option<String>,
    anchor_row_index: Option<usize>,
) -> Result<CommitHistoryWindow, String> {
    let history = ready_history(&path, history_mode)?;
    Ok(build_commit_history_window(
        history,
        offset,
        limit,
        anchor_sha.as_deref(),
        anchor_row_index,
    ))
}

#[tauri::command]
pub fn get_commit_graph_window(
    path: String,
    history_mode: Option<CommitHistoryMode>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<CommitGraphWindow, String> {
    let history = ready_history(&path, history_mode)?;
    Ok(build_commit_graph_window(history, offset, limit))
}

#[tauri::command]
pub async fn search_commit_history(
    path: String,
    history_mode: Option<CommitHistoryMode>,
    query: String,
    current_row_index: Option<usize>,
    direction: Option<CommitSearchDirection>,
) -> Result<CommitHistorySearchResponse, String> {
    let history = ready_history(&path, history_mode)?;
    spawn_blocking(move || search_commits(&history, query, current_row_index, direction))
        .await
        .map_err(|e| e.to_string())
}

fn spawn_history_job(key: CommitHistoryCacheKey, generation: u64) {
    spawn_blocking(move || {
        let result = collect_prepared_commit_graph(&key.path, key.history_mode);
        complete_history_job(key, generation, result);
    });
}

fn begin_prepare_history(
    cache: &mut CommitHistoryCache,
    key: CommitHistoryCacheKey,
    force_refresh: bool,
) -> PrepareHistoryDecision {
    if force_refresh {
        cache.entries.remove(&key);
    }

    if let Some(entry) = cache.entries.get(&key) {
        return PrepareHistoryDecision::Return(status_from_entry(entry));
    }

    let generation = cache.next_generation();
    cache
        .entries
        .insert(key, CommitHistoryCacheEntry::Loading { generation });
    PrepareHistoryDecision::Spawn { generation }
}

fn complete_history_job(
    key: CommitHistoryCacheKey,
    generation: u64,
    result: Result<PreparedCommitGraph, String>,
) {
    let Ok(mut cache) = COMMIT_HISTORY_CACHE.lock() else {
        return;
    };

    let Some(CommitHistoryCacheEntry::Loading {
        generation: current_generation,
    }) = cache.entries.get(&key)
    else {
        return;
    };

    if *current_generation != generation {
        return;
    }

    let entry = match result {
        Ok(history) => CommitHistoryCacheEntry::Ready {
            history: Arc::new(history),
        },
        Err(error) => CommitHistoryCacheEntry::Error { message: error },
    };

    cache.entries.insert(key, entry);
}

fn status_from_entry(entry: &CommitHistoryCacheEntry) -> CommitHistoryStatusResponse {
    match entry {
        CommitHistoryCacheEntry::Loading { .. } => CommitHistoryStatusResponse {
            status: CommitHistoryCacheStatus::Loading,
            total_count: 0,
            error: None,
        },
        CommitHistoryCacheEntry::Ready { history, .. } => CommitHistoryStatusResponse {
            status: CommitHistoryCacheStatus::Ready,
            total_count: history.len(),
            error: None,
        },
        CommitHistoryCacheEntry::Error { message, .. } => CommitHistoryStatusResponse {
            status: CommitHistoryCacheStatus::Error,
            total_count: 0,
            error: Some(message.clone()),
        },
    }
}

fn ready_history(
    path: &str,
    history_mode: Option<CommitHistoryMode>,
) -> Result<Arc<PreparedCommitGraph>, String> {
    let history_mode = history_mode.unwrap_or(CommitHistoryMode::GitLog);
    let key = CommitHistoryCacheKey {
        path: path.to_string(),
        history_mode,
    };
    let cache = COMMIT_HISTORY_CACHE.lock().map_err(|e| e.to_string())?;
    match cache.entries.get(&key) {
        Some(CommitHistoryCacheEntry::Ready { history, .. }) => Ok(Arc::clone(history)),
        Some(CommitHistoryCacheEntry::Loading { .. }) => {
            Err("Commit history is still loading.".to_string())
        }
        Some(CommitHistoryCacheEntry::Error { message, .. }) => Err(message.clone()),
        None => Err("Commit history has not been prepared.".to_string()),
    }
}

fn bounded_limit(limit: Option<usize>) -> usize {
    limit
        .unwrap_or(DEFAULT_HISTORY_WINDOW_SIZE)
        .clamp(1, MAX_HISTORY_WINDOW_SIZE)
}

fn build_commit_history_window(
    history: Arc<PreparedCommitGraph>,
    offset: Option<usize>,
    limit: Option<usize>,
    anchor_sha: Option<&str>,
    anchor_row_index: Option<usize>,
) -> CommitHistoryWindow {
    let total_count = history.len();
    let limit = bounded_limit(limit);
    let mut start = offset.unwrap_or(0);

    if let Some(anchor_row_index) = anchor_row_index {
        if anchor_row_index < total_count {
            start = anchor_row_index.saturating_sub(limit / 2);
        }
    } else if let Some(anchor_sha) = anchor_sha {
        if let Some(index) = history
            .commits()
            .iter()
            .position(|commit| commit.sha == anchor_sha)
        {
            start = index.saturating_sub(limit / 2);
        }
    }

    if start >= total_count {
        start = total_count.saturating_sub(limit);
    }

    let end = start.saturating_add(limit).min(total_count);

    CommitHistoryWindow {
        commits: history.window_commits(start, end),
        offset: start,
        limit,
        total_count,
        has_previous: start > 0,
        has_more: end < total_count,
    }
}

fn build_commit_graph_window(
    history: Arc<PreparedCommitGraph>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> CommitGraphWindow {
    let total_count = history.len();
    let limit = bounded_limit(limit);
    let start = offset.unwrap_or(0).min(total_count.saturating_sub(limit));
    let end = start.saturating_add(limit).min(total_count);

    CommitGraphWindow {
        rows: history.graph_window_rows(start, end),
        offset: start,
        limit,
        total_count,
    }
}

fn search_commits(
    history: &PreparedCommitGraph,
    query: String,
    current_row_index: Option<usize>,
    direction: Option<CommitSearchDirection>,
) -> CommitHistorySearchResponse {
    let normalized_query = query.trim().to_lowercase();
    if normalized_query.is_empty() {
        return CommitHistorySearchResponse {
            query,
            match_count: 0,
            current_match_position: None,
            matched_row_index: None,
            matched_sha: None,
        };
    }

    let commits = history.commits();
    let matches: Vec<usize> = commits
        .iter()
        .enumerate()
        .filter_map(|(index, commit)| {
            if searchable_commit_text(commit).contains(&normalized_query) {
                Some(index)
            } else {
                None
            }
        })
        .collect();

    let matched_row_index = match direction {
        Some(CommitSearchDirection::Next) => next_match(&matches, current_row_index),
        Some(CommitSearchDirection::Previous) => previous_match(&matches, current_row_index),
        None => current_row_index.filter(|current| matches.contains(current)),
    };

    let current_match_position = matched_row_index.and_then(|row_index| {
        matches
            .iter()
            .position(|match_index| *match_index == row_index)
    });

    let matched_sha = matched_row_index
        .and_then(|row_index| commits.get(row_index).map(|commit| commit.sha.clone()));

    CommitHistorySearchResponse {
        query,
        match_count: matches.len(),
        current_match_position,
        matched_row_index,
        matched_sha,
    }
}

fn searchable_commit_text(commit: &CommitListItem) -> String {
    format!(
        "{} {} {} {}",
        commit.message,
        commit.author,
        commit.sha,
        commit.refs.join(" ")
    )
    .to_lowercase()
}

fn next_match(matches: &[usize], current_row_index: Option<usize>) -> Option<usize> {
    if matches.is_empty() {
        return None;
    }

    let Some(current_row_index) = current_row_index else {
        return matches.first().copied();
    };

    matches
        .iter()
        .copied()
        .find(|match_index| *match_index > current_row_index)
        .or_else(|| matches.first().copied())
}

fn previous_match(matches: &[usize], current_row_index: Option<usize>) -> Option<usize> {
    if matches.is_empty() {
        return None;
    }

    let Some(current_row_index) = current_row_index else {
        return matches.last().copied();
    };

    matches
        .iter()
        .rev()
        .copied()
        .find(|match_index| *match_index < current_row_index)
        .or_else(|| matches.last().copied())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn commit(sha: &str, message: &str, refs: &[&str]) -> CommitListItem {
        CommitListItem {
            sha: sha.to_string(),
            parents: Vec::new(),
            graph_width: 0,
            graph_lane: 0,
            graph_color: 0,
            graph_segments: Vec::new(),
            refs: refs.iter().map(|label| label.to_string()).collect(),
            message: message.to_string(),
            author: "Ada Lovelace".to_string(),
            author_initial: "A".to_string(),
            author_avatar_url: None,
            date: 1,
            current_branch: String::new(),
            source_branch: String::new(),
            commit_history: Vec::new(),
            files: 0,
        }
    }

    fn history() -> Arc<PreparedCommitGraph> {
        Arc::new(PreparedCommitGraph::from_commits_for_test(vec![
            commit("aaa111", "Initial import", &["main"]),
            commit("bbb222", "Fix scheduler", &[]),
            commit("ccc333", "Update docs", &["tag: v1.0.0"]),
            commit("ddd444", "Fix networking", &["origin/main"]),
        ]))
    }

    fn key(path: &str) -> CommitHistoryCacheKey {
        CommitHistoryCacheKey {
            path: path.to_string(),
            history_mode: CommitHistoryMode::GitLog,
        }
    }

    #[test]
    fn begin_prepare_spawns_once_and_reuses_loading_state() {
        let mut cache = CommitHistoryCache::default();
        let key = key("/repo");

        let first_decision = begin_prepare_history(&mut cache, key.clone(), false);
        assert_eq!(
            first_decision,
            PrepareHistoryDecision::Spawn { generation: 1 }
        );

        let second_decision = begin_prepare_history(&mut cache, key, false);
        assert_eq!(
            second_decision,
            PrepareHistoryDecision::Return(CommitHistoryStatusResponse {
                status: CommitHistoryCacheStatus::Loading,
                total_count: 0,
                error: None,
            })
        );
    }

    #[test]
    fn force_refresh_replaces_ready_state_with_new_loading_generation() {
        let mut cache = CommitHistoryCache::default();
        let key = key("/repo");
        cache.entries.insert(
            key.clone(),
            CommitHistoryCacheEntry::Ready { history: history() },
        );

        let decision = begin_prepare_history(&mut cache, key, true);

        assert_eq!(decision, PrepareHistoryDecision::Spawn { generation: 1 });
        assert!(matches!(
            cache.entries.values().next(),
            Some(CommitHistoryCacheEntry::Loading { generation: 1 })
        ));
    }

    #[test]
    fn status_reports_ready_and_error_entries() {
        let ready = status_from_entry(&CommitHistoryCacheEntry::Ready { history: history() });
        assert_eq!(ready.status, CommitHistoryCacheStatus::Ready);
        assert_eq!(ready.total_count, 4);

        let error = status_from_entry(&CommitHistoryCacheEntry::Error {
            message: "failed".to_string(),
        });
        assert_eq!(error.status, CommitHistoryCacheStatus::Error);
        assert_eq!(error.error.as_deref(), Some("failed"));
    }

    #[test]
    fn builds_bounded_window_from_offset() {
        let window = build_commit_history_window(history(), Some(1), Some(2), None, None);

        assert_eq!(window.offset, 1);
        assert_eq!(window.total_count, 4);
        assert!(window.has_previous);
        assert!(window.has_more);
        assert_eq!(
            window
                .commits
                .iter()
                .map(|commit| commit.sha.as_str())
                .collect::<Vec<_>>(),
            vec!["bbb222", "ccc333"]
        );
    }

    #[test]
    fn builds_bounded_window_around_sha() {
        let window = build_commit_history_window(history(), None, Some(3), Some("ddd444"), None);

        assert_eq!(window.offset, 2);
        assert_eq!(
            window
                .commits
                .iter()
                .map(|commit| commit.sha.as_str())
                .collect::<Vec<_>>(),
            vec!["ccc333", "ddd444"]
        );
    }

    #[test]
    fn builds_bounded_graph_window_without_commit_details() {
        let window = build_commit_graph_window(history(), Some(1), Some(2));

        assert_eq!(window.offset, 1);
        assert_eq!(window.total_count, 4);
        assert_eq!(
            window
                .rows
                .iter()
                .map(|row| row.row_index)
                .collect::<Vec<_>>(),
            vec![1, 2],
        );
        assert_eq!(window.rows[1].refs, vec!["tag: v1.0.0"]);
    }

    #[test]
    fn search_matches_commit_metadata_and_refs() {
        let response = search_commits(&history(), "fix".to_string(), None, None);

        assert_eq!(response.match_count, 2);
        assert_eq!(response.matched_row_index, None);

        let next = search_commits(
            &history(),
            "fix".to_string(),
            Some(1),
            Some(CommitSearchDirection::Next),
        );

        assert_eq!(next.match_count, 2);
        assert_eq!(next.current_match_position, Some(1));
        assert_eq!(next.matched_row_index, Some(3));
        assert_eq!(next.matched_sha.as_deref(), Some("ddd444"));
    }

    #[test]
    fn previous_search_navigation_wraps() {
        let response = search_commits(
            &history(),
            "fix".to_string(),
            Some(1),
            Some(CommitSearchDirection::Previous),
        );

        assert_eq!(response.current_match_position, Some(1));
        assert_eq!(response.matched_row_index, Some(3));
    }
}
