use super::classify::process_notify_result;
use super::events::emit_repo_changed_event;
use super::snapshot::RepoSnapshot;
use crate::git::types::RepoChangeKind;
use git2::Repository;
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::AppHandle;

const WATCH_DEBOUNCE_MS: u64 = 180;

struct RepoWatcher {
    stop_tx: mpsc::Sender<()>,
    worker: JoinHandle<()>,
    _watcher: RecommendedWatcher,
}

#[derive(Default)]
struct RepoWatchManager {
    watchers: HashMap<String, RepoWatcher>,
}

impl RepoWatchManager {
    fn sync(&mut self, app: &AppHandle, repo_paths: &[String]) -> Result<(), String> {
        let desired: HashSet<String> = repo_paths
            .iter()
            .filter(|path| !path.is_empty())
            .cloned()
            .collect();

        for existing in self.watchers.keys().cloned().collect::<Vec<_>>() {
            if !desired.contains(&existing) {
                self.stop_watcher(&existing);
            }
        }

        for repo_path in desired {
            if self.watchers.contains_key(&repo_path) {
                continue;
            }
            match start_repo_watcher(app.clone(), repo_path.clone()) {
                Ok(watcher) => {
                    self.watchers.insert(repo_path, watcher);
                }
                Err(error) => {
                    eprintln!(
                        "Failed to start repository watcher for '{}': {}",
                        repo_path, error
                    );
                }
            }
        }

        Ok(())
    }

    fn stop_watcher(&mut self, repo_path: &str) {
        if let Some(watcher) = self.watchers.remove(repo_path) {
            let _ = watcher.stop_tx.send(());
            let _ = watcher.worker.join();
        }
    }
}

static REPO_WATCH_MANAGER: Lazy<Mutex<RepoWatchManager>> =
    Lazy::new(|| Mutex::new(RepoWatchManager::default()));

fn start_repo_watcher(app: AppHandle, repo_path: String) -> Result<RepoWatcher, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let git_dir = repo.path().to_path_buf();
    let worktree_dir = repo
        .workdir()
        .map(Path::to_path_buf)
        .ok_or_else(|| format!("Repository has no working directory: {repo_path}"))?;

    let (event_tx, event_rx) = mpsc::channel::<notify::Result<Event>>();
    let (stop_tx, stop_rx) = mpsc::channel::<()>();

    let mut watcher = notify::recommended_watcher(move |result| {
        let _ = event_tx.send(result);
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(&git_dir, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    watcher
        .watch(&worktree_dir, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    let worker = thread::spawn(move || {
        let debounce = Duration::from_millis(WATCH_DEBOUNCE_MS);
        let mut snapshot = RepoSnapshot::load(&repo_path).ok();
        let mut pending_kinds = HashSet::new();

        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            match event_rx.recv_timeout(debounce) {
                Ok(result) => {
                    process_notify_result(result, &git_dir, &mut pending_kinds);
                }
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => break,
            }

            loop {
                match event_rx.recv_timeout(debounce) {
                    Ok(result) => {
                        process_notify_result(result, &git_dir, &mut pending_kinds);
                    }
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }

            if pending_kinds.is_empty() {
                continue;
            }

            match RepoSnapshot::load(&repo_path) {
                Ok(next_snapshot) => {
                    let mut emit_kinds = pending_kinds.clone();

                    if let Some(previous_snapshot) = &snapshot {
                        emit_kinds.extend(previous_snapshot.diff_kinds(&next_snapshot));
                    } else {
                        emit_kinds.insert(RepoChangeKind::Head);
                        emit_kinds.insert(RepoChangeKind::Branches);
                        emit_kinds.insert(RepoChangeKind::Tags);
                        emit_kinds.insert(RepoChangeKind::Stashes);
                        emit_kinds.insert(RepoChangeKind::RemoteRefs);
                    }

                    emit_repo_changed_event(&app, &repo_path, emit_kinds.into_iter().collect());
                    snapshot = Some(next_snapshot);
                    pending_kinds.clear();
                }
                Err(_) => {
                    pending_kinds.clear();
                }
            }
        }
    });

    Ok(RepoWatcher {
        stop_tx,
        worker,
        _watcher: watcher,
    })
}

#[tauri::command]
pub fn sync_repo_watchers(app: AppHandle, repo_paths: Vec<String>) -> Result<(), String> {
    let mut manager = REPO_WATCH_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.sync(&app, &repo_paths)
}
