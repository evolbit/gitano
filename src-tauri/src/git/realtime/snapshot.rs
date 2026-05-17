use crate::git::types::RepoChangeKind;
use git2::Repository;
use std::collections::HashSet;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(super) struct RepoSnapshot {
    head_ref: Option<String>,
    head_oid: Option<String>,
    branches_sig: String,
    tags_sig: String,
    stash_oid: Option<String>,
    remote_refs_sig: String,
}

impl RepoSnapshot {
    pub(super) fn load(repo_path: &str) -> Result<Self, String> {
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

    pub(super) fn diff_kinds(&self, next: &Self) -> HashSet<RepoChangeKind> {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(values: &[RepoChangeKind]) -> HashSet<RepoChangeKind> {
        values.iter().copied().collect()
    }

    #[test]
    fn reports_changed_snapshot_sections_as_repo_change_kinds() {
        let previous = RepoSnapshot {
            head_ref: Some("refs/heads/main".to_string()),
            head_oid: Some("a".to_string()),
            branches_sig: "main:a".to_string(),
            tags_sig: "v1:a".to_string(),
            stash_oid: None,
            remote_refs_sig: "origin/main:a".to_string(),
        };
        let next = RepoSnapshot {
            head_ref: Some("refs/heads/feature".to_string()),
            head_oid: Some("b".to_string()),
            branches_sig: "feature:b|main:a".to_string(),
            tags_sig: "v1:b".to_string(),
            stash_oid: Some("stash".to_string()),
            remote_refs_sig: "origin/main:b".to_string(),
        };

        assert_eq!(
            previous.diff_kinds(&next),
            kinds(&[
                RepoChangeKind::Head,
                RepoChangeKind::Branches,
                RepoChangeKind::Tags,
                RepoChangeKind::Stashes,
                RepoChangeKind::RemoteRefs,
            ])
        );
    }
}
