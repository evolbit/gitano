use std::fs;
use std::path::Path;

pub(super) fn normalize_branch_ref(ref_name: &str) -> String {
    ref_name
        .strip_prefix("refs/heads/")
        .or_else(|| ref_name.strip_prefix("refs/remotes/"))
        .unwrap_or(ref_name)
        .to_string()
}

pub(super) fn path_basename(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or(path)
        .to_string()
}

pub(super) fn parent_basename(path: &str) -> Option<String> {
    Path::new(path)
        .parent()
        .and_then(|value| value.file_name())
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

pub(super) fn worktree_display_name(path: &str, main_checkout_name: Option<&str>) -> String {
    let basename = path_basename(path);

    match main_checkout_name {
        Some(main_name) if basename == main_name => parent_basename(path).unwrap_or(basename),
        _ => basename,
    }
}

pub(super) fn canonical_path(path: &str) -> String {
    fs::canonicalize(path)
        .ok()
        .and_then(|value| value.to_str().map(ToString::to_string))
        .unwrap_or_else(|| path.to_string())
}

pub(super) fn same_path(left: &str, right: &str) -> bool {
    canonical_path(left) == canonical_path(right)
}

#[cfg(test)]
mod tests {
    use super::*;

    mod normalize_branch_ref {
        use super::*;

        #[test]
        fn strips_local_and_remote_ref_prefixes() {
            assert_eq!(normalize_branch_ref("refs/heads/main"), "main");
            assert_eq!(
                normalize_branch_ref("refs/remotes/origin/main"),
                "origin/main"
            );
        }
    }

    mod worktree_display_name {
        use super::*;

        #[test]
        fn uses_parent_name_when_linked_worktree_folder_matches_main_checkout() {
            assert_eq!(
                worktree_display_name("/repos/repo-feature/repo", Some("repo")),
                "repo-feature"
            );
        }

        #[test]
        fn uses_path_basename_for_distinct_worktree_folders() {
            assert_eq!(
                worktree_display_name("/repos/repo.worktrees/feature-a", Some("repo")),
                "feature-a"
            );
        }
    }
}
