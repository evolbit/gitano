use crate::git::types::{RepoChangeKind, RepoChangedEvent};
use git2::Repository;
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const REPO_CHANGED_EVENT: &str = "gitano:repo-changed";
const WATCH_DEBOUNCE_MS: u64 = 180;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct RepoSnapshot {
    head_ref: Option<String>,
    head_oid: Option<String>,
    branches_sig: String,
    tags_sig: String,
    stash_oid: Option<String>,
    remote_refs_sig: String,
}

impl RepoSnapshot {
    fn load(repo_path: &str) -> Result<Self, String> {
        let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

        let (head_ref, head_oid) = match repo.head() {
            Ok(head) => (
                head.name().map(|name| name.to_string()),
                head.target().map(|oid| oid.to_string()),
            ),
            Err(_) => (None, None),
        };

        let mut branches = Vec::new();
        if let Ok(iter) = repo.branches(Some(git2::BranchType::Local)) {
            for branch_result in iter {
                let Ok((branch, _)) = branch_result else {
                    continue;
                };
                let name = branch
                    .name()
                    .ok()
                    .flatten()
                    .map(str::to_string)
                    .unwrap_or_default();
                let oid = branch
                    .get()
                    .target()
                    .map(|target| target.to_string())
                    .unwrap_or_default();
                branches.push(format!("{name}:{oid}"));
            }
        }
        branches.sort();

        let mut tags = Vec::new();
        if let Ok(tag_names) = repo.tag_names(None) {
            for tag_name in tag_names.iter().flatten() {
                let resolved = repo
                    .revparse_single(tag_name)
                    .ok()
                    .map(|obj| obj.id().to_string())
                    .unwrap_or_default();
                tags.push(format!("{tag_name}:{resolved}"));
            }
        }
        tags.sort();

        let stash_oid = repo
            .refname_to_id("refs/stash")
            .ok()
            .map(|oid| oid.to_string());

        let mut remote_refs = Vec::new();
        if let Ok(iter) = repo.references() {
            for reference in iter.flatten() {
                let Some(name) = reference.name() else {
                    continue;
                };
                if !name.starts_with("refs/remotes/") {
                    continue;
                }
                let oid = reference
                    .target()
                    .map(|target| target.to_string())
                    .unwrap_or_default();
                remote_refs.push(format!("{name}:{oid}"));
            }
        }
        remote_refs.sort();

        Ok(Self {
            head_ref,
            head_oid,
            branches_sig: branches.join("|"),
            tags_sig: tags.join("|"),
            stash_oid,
            remote_refs_sig: remote_refs.join("|"),
        })
    }

    fn diff_kinds(&self, next: &Self) -> HashSet<RepoChangeKind> {
        let mut kinds = HashSet::new();

        if self.head_ref != next.head_ref || self.head_oid != next.head_oid {
            kinds.insert(RepoChangeKind::Head);
        }
        if self.branches_sig != next.branches_sig {
            kinds.insert(RepoChangeKind::Branches);
        }
        if self.tags_sig != next.tags_sig {
            kinds.insert(RepoChangeKind::Tags);
        }
        if self.stash_oid != next.stash_oid {
            kinds.insert(RepoChangeKind::Stashes);
        }
        if self.remote_refs_sig != next.remote_refs_sig {
            kinds.insert(RepoChangeKind::RemoteRefs);
        }

        kinds
    }
}

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

fn process_notify_result(
    result: notify::Result<Event>,
    git_dir: &Path,
    pending_kinds: &mut HashSet<RepoChangeKind>,
) {
    let Ok(event) = result else {
        pending_kinds.insert(RepoChangeKind::WorkingTree);
        pending_kinds.insert(RepoChangeKind::Index);
        pending_kinds.insert(RepoChangeKind::Head);
        pending_kinds.insert(RepoChangeKind::Branches);
        pending_kinds.insert(RepoChangeKind::Tags);
        pending_kinds.insert(RepoChangeKind::Stashes);
        pending_kinds.insert(RepoChangeKind::RemoteRefs);
        pending_kinds.insert(RepoChangeKind::Config);
        return;
    };

    if event.need_rescan() {
        pending_kinds.insert(RepoChangeKind::WorkingTree);
        pending_kinds.insert(RepoChangeKind::Index);
        pending_kinds.insert(RepoChangeKind::Head);
        pending_kinds.insert(RepoChangeKind::Branches);
        pending_kinds.insert(RepoChangeKind::Tags);
        pending_kinds.insert(RepoChangeKind::Stashes);
        pending_kinds.insert(RepoChangeKind::RemoteRefs);
        pending_kinds.insert(RepoChangeKind::Config);
        return;
    }

    if event.paths.is_empty() {
        pending_kinds.insert(RepoChangeKind::WorkingTree);
        pending_kinds.insert(RepoChangeKind::Index);
        pending_kinds.insert(RepoChangeKind::Head);
        pending_kinds.insert(RepoChangeKind::Branches);
        pending_kinds.insert(RepoChangeKind::Tags);
        pending_kinds.insert(RepoChangeKind::Stashes);
        pending_kinds.insert(RepoChangeKind::RemoteRefs);
        pending_kinds.insert(RepoChangeKind::Config);
        return;
    }

    for path in event.paths {
        classify_path(&path, git_dir, pending_kinds);
    }
}

fn classify_path(path: &PathBuf, git_dir: &Path, pending_kinds: &mut HashSet<RepoChangeKind>) {
    if let Ok(relative) = path.strip_prefix(git_dir) {
        let normalized = relative.to_string_lossy();

        if normalized == "HEAD" {
            pending_kinds.insert(RepoChangeKind::Head);
            pending_kinds.insert(RepoChangeKind::Branches);
            return;
        }
        if normalized == "index" {
            pending_kinds.insert(RepoChangeKind::Index);
            pending_kinds.insert(RepoChangeKind::WorkingTree);
            return;
        }
        if normalized == "packed-refs" {
            pending_kinds.insert(RepoChangeKind::Head);
            pending_kinds.insert(RepoChangeKind::Branches);
            pending_kinds.insert(RepoChangeKind::Tags);
            pending_kinds.insert(RepoChangeKind::Stashes);
            pending_kinds.insert(RepoChangeKind::RemoteRefs);
            return;
        }
        if normalized == "config" {
            pending_kinds.insert(RepoChangeKind::Config);
            return;
        }

        if normalized.starts_with("refs/heads/") || normalized.starts_with("logs/refs/heads/") {
            pending_kinds.insert(RepoChangeKind::Branches);
            pending_kinds.insert(RepoChangeKind::Head);
            return;
        }
        if normalized.starts_with("refs/tags/") || normalized.starts_with("logs/refs/tags/") {
            pending_kinds.insert(RepoChangeKind::Tags);
            return;
        }
        if normalized.starts_with("refs/stash") || normalized.starts_with("logs/refs/stash") {
            pending_kinds.insert(RepoChangeKind::Stashes);
            return;
        }
        if normalized.starts_with("refs/remotes/") || normalized.starts_with("logs/refs/remotes/") {
            pending_kinds.insert(RepoChangeKind::RemoteRefs);
            return;
        }

        pending_kinds.insert(RepoChangeKind::WorkingTree);
        return;
    }

    pending_kinds.insert(RepoChangeKind::WorkingTree);
}

fn emit_repo_changed_event(app: &AppHandle, repo_path: &str, mut kinds: Vec<RepoChangeKind>) {
    if kinds.is_empty() {
        return;
    }

    kinds.sort_by_key(repo_change_kind_order);
    kinds.dedup();

    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0);

    let payload = RepoChangedEvent {
        repo_path: repo_path.to_string(),
        kinds,
        timestamp_ms,
    };

    let _ = app.emit(REPO_CHANGED_EVENT, payload);
}

fn repo_change_kind_order(kind: &RepoChangeKind) -> u8 {
    match kind {
        RepoChangeKind::WorkingTree => 0,
        RepoChangeKind::Index => 1,
        RepoChangeKind::Head => 2,
        RepoChangeKind::Branches => 3,
        RepoChangeKind::Tags => 4,
        RepoChangeKind::Stashes => 5,
        RepoChangeKind::RemoteRefs => 6,
        RepoChangeKind::Config => 7,
    }
}

#[tauri::command]
pub fn sync_repo_watchers(app: AppHandle, repo_paths: Vec<String>) -> Result<(), String> {
    let mut manager = REPO_WATCH_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.sync(&app, &repo_paths)
}
