use crate::git::types::{RepoChangeKind, RepoChangedEvent};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const REPO_CHANGED_EVENT: &str = "gitano:repo-changed";

pub(super) fn emit_repo_changed_event(
    app: &AppHandle,
    repo_path: &str,
    mut kinds: Vec<RepoChangeKind>,
) {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_event_payloads_in_stable_refresh_order() {
        let mut kinds = vec![
            RepoChangeKind::Config,
            RepoChangeKind::WorkingTree,
            RepoChangeKind::Branches,
        ];

        kinds.sort_by_key(repo_change_kind_order);

        assert_eq!(
            kinds,
            vec![
                RepoChangeKind::WorkingTree,
                RepoChangeKind::Branches,
                RepoChangeKind::Config,
            ]
        );
    }
}
