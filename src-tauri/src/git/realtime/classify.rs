use crate::git::types::RepoChangeKind;
use notify::Event;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub(super) fn process_notify_result(
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

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(values: &[RepoChangeKind]) -> HashSet<RepoChangeKind> {
        values.iter().copied().collect()
    }

    #[test]
    fn classifies_index_changes_as_index_and_working_tree_refreshes() {
        let mut pending_kinds = HashSet::new();

        classify_path(
            &PathBuf::from("/repo/.git/index"),
            Path::new("/repo/.git"),
            &mut pending_kinds,
        );

        assert_eq!(
            pending_kinds,
            kinds(&[RepoChangeKind::Index, RepoChangeKind::WorkingTree])
        );
    }

    #[test]
    fn classifies_branch_ref_changes_as_branch_and_head_refreshes() {
        let mut pending_kinds = HashSet::new();

        classify_path(
            &PathBuf::from("/repo/.git/refs/heads/feature"),
            Path::new("/repo/.git"),
            &mut pending_kinds,
        );

        assert_eq!(
            pending_kinds,
            kinds(&[RepoChangeKind::Branches, RepoChangeKind::Head])
        );
    }

    #[test]
    fn treats_worktree_paths_outside_git_dir_as_working_tree_changes() {
        let mut pending_kinds = HashSet::new();

        classify_path(
            &PathBuf::from("/repo/src/file.rs"),
            Path::new("/repo/.git"),
            &mut pending_kinds,
        );

        assert_eq!(pending_kinds, kinds(&[RepoChangeKind::WorkingTree]));
    }
}
