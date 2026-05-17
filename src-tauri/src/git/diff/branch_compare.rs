use super::parse_unified_diff;
use crate::git::types::*;
use git2::{ObjectType, Oid, Repository};
use serde::Deserialize;
use std::process::Command;

fn validate_ref_name<'a>(ref_name: &'a str, label: &str) -> Result<&'a str, String> {
    let ref_name = ref_name.trim();

    if ref_name.is_empty() {
        return Err(format!("{} branch is required.", label));
    }

    Ok(ref_name)
}

fn resolve_commit<'repo>(
    repo: &'repo Repository,
    ref_name: &str,
    label: &str,
) -> Result<git2::Commit<'repo>, String> {
    let object = repo
        .revparse_single(ref_name)
        .map_err(|e| format!("Could not resolve {} branch '{}': {}", label, ref_name, e))?;
    let commit_object = object.peel(ObjectType::Commit).map_err(|e| {
        format!(
            "Could not peel {} branch '{}' to a commit: {}",
            label, ref_name, e
        )
    })?;

    commit_object.into_commit().map_err(|_| {
        format!(
            "{} branch '{}' does not resolve to a commit.",
            label, ref_name
        )
    })
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BranchComparisonMode {
    Direct,
    MergeBase,
}

impl Default for BranchComparisonMode {
    fn default() -> Self {
        Self::MergeBase
    }
}

fn resolve_branch_comparison_refs(
    path: &str,
    base_ref: &str,
    head_ref: &str,
) -> Result<(Repository, Oid, Oid), String> {
    let base_ref = validate_ref_name(base_ref, "Base")?;
    let head_ref = validate_ref_name(head_ref, "Head")?;
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let base_commit = resolve_commit(&repo, base_ref, "base")?;
    let head_commit = resolve_commit(&repo, head_ref, "head")?;
    let base_oid = base_commit.id();
    let head_oid = head_commit.id();

    drop(base_commit);
    drop(head_commit);

    Ok((repo, base_oid, head_oid))
}

fn resolve_branch_comparison_from_oid(
    repo: &Repository,
    base_oid: Oid,
    head_oid: Oid,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: Option<BranchComparisonMode>,
) -> Result<Oid, String> {
    match comparison_mode.unwrap_or_default() {
        BranchComparisonMode::Direct => Ok(base_oid),
        BranchComparisonMode::MergeBase => repo.merge_base(base_oid, head_oid).map_err(|e| {
            format!(
                "Could not find merge base for '{}' and '{}': {}",
                base_ref, head_ref, e
            )
        }),
    }
}

fn diff_delta_path(delta: &git2::DiffDelta<'_>) -> Option<String> {
    delta
        .new_file()
        .path()
        .or_else(|| delta.old_file().path())
        .and_then(|path| path.to_str())
        .map(ToString::to_string)
}

pub fn get_branch_comparison_files(
    path: String,
    base_ref: String,
    head_ref: String,
    comparison_mode: Option<BranchComparisonMode>,
) -> Result<Vec<FileChange>, String> {
    let (repo, base_oid, head_oid) = resolve_branch_comparison_refs(&path, &base_ref, &head_ref)?;
    let from_oid = resolve_branch_comparison_from_oid(
        &repo,
        base_oid,
        head_oid,
        &base_ref,
        &head_ref,
        comparison_mode,
    )?;
    let from_commit = repo.find_commit(from_oid).map_err(|e| e.to_string())?;
    let head_commit = repo.find_commit(head_oid).map_err(|e| e.to_string())?;
    let from_tree = from_commit.tree().map_err(|e| e.to_string())?;
    let head_tree = head_commit.tree().map_err(|e| e.to_string())?;
    let diff = repo
        .diff_tree_to_tree(Some(&from_tree), Some(&head_tree), None)
        .map_err(|e| e.to_string())?;

    let mut changes = Vec::new();

    for i in 0..diff.deltas().len() {
        let Some(delta) = diff.get_delta(i) else {
            continue;
        };
        let Some(path) = diff_delta_path(&delta) else {
            continue;
        };
        let patch_result = git2::Patch::from_diff(&diff, i);
        let (insertions, deletions) = if let Ok(Some(patch)) = patch_result {
            patch
                .line_stats()
                .map(|stats| (stats.1 as u32, stats.2 as u32))
                .unwrap_or((0, 0))
        } else {
            (0, 0)
        };

        changes.push(FileChange {
            path,
            status: delta.status().into(),
            insertions,
            deletions,
        });
    }

    Ok(changes)
}

pub fn get_branch_comparison_file_diff(
    path: String,
    base_ref: String,
    head_ref: String,
    file_path: String,
    context: usize,
    comparison_mode: Option<BranchComparisonMode>,
) -> Result<Vec<DiffHunk>, String> {
    let (repo, base_oid, head_oid) = resolve_branch_comparison_refs(&path, &base_ref, &head_ref)?;
    let from_oid = resolve_branch_comparison_from_oid(
        &repo,
        base_oid,
        head_oid,
        &base_ref,
        &head_ref,
        comparison_mode,
    )?;
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg(format!("-U{}", context))
        .arg(from_oid.to_string())
        .arg(head_oid.to_string())
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "git diff failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let diff = String::from_utf8_lossy(&output.stdout);

    if diff.trim().is_empty() {
        return Ok(vec![]);
    }

    Ok(parse_unified_diff(&diff))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};

    #[test]
    fn returns_changed_files_between_base_and_head_refs() {
        let repo = init_repo();
        commit_file(repo.path(), "src/file.txt", "one\n", "initial");
        run_git(repo.path(), &["checkout", "-b", "feature"]);
        commit_file(repo.path(), "src/file.txt", "one\ntwo\n", "change file");

        let changes = get_branch_comparison_files(
            repo.path().to_string_lossy().to_string(),
            "main".to_string(),
            "feature".to_string(),
            Some(BranchComparisonMode::Direct),
        )
        .expect("branch comparison should succeed");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "src/file.txt");
        assert_eq!(changes[0].insertions, 1);
    }

    #[test]
    fn rejects_blank_base_refs_before_opening_the_repo() {
        let error = get_branch_comparison_files(
            "/does-not-need-to-exist".to_string(),
            " ".to_string(),
            "feature".to_string(),
            None,
        )
        .expect_err("blank base ref should fail validation");

        assert_eq!(error, "Base branch is required.");
    }
}
