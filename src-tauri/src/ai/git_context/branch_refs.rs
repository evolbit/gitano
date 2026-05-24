use super::{run_git, LocalAiBranchContextStep};

pub(super) struct BranchComparisonRefs {
    pub(super) base_sha: String,
    pub(super) head_sha: String,
    pub(super) from_ref: String,
}

pub(super) struct BranchDiffSummary {
    pub(super) name_status: String,
    pub(super) stat: String,
}

pub(super) fn resolve_branch_comparison_refs<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    on_step: &mut F,
) -> Result<BranchComparisonRefs, String>
where
    F: FnMut(LocalAiBranchContextStep),
{
    on_step(LocalAiBranchContextStep::ResolvingRefs);
    let base_sha = run_git(repo_path, &["rev-parse", base_ref])?;
    let head_sha = run_git(repo_path, &["rev-parse", head_ref])?;
    on_step(LocalAiBranchContextStep::DeterminingDiffBase);
    let from_ref = if is_merge_base_comparison(comparison_mode) {
        run_git(repo_path, &["merge-base", base_ref, head_ref])?
    } else {
        base_sha.clone()
    };

    Ok(BranchComparisonRefs {
        base_sha,
        head_sha: head_sha.trim().to_string(),
        from_ref: from_ref.trim().to_string(),
    })
}

pub(super) fn read_branch_diff_summary(
    repo_path: &str,
    refs: &BranchComparisonRefs,
) -> Result<BranchDiffSummary, String> {
    Ok(BranchDiffSummary {
        name_status: run_git(
            repo_path,
            &["diff", "--name-status", &refs.from_ref, &refs.head_sha],
        )?,
        stat: run_git(
            repo_path,
            &["diff", "--stat", &refs.from_ref, &refs.head_sha],
        )?,
    })
}

pub(super) fn read_branch_diff_fingerprint(
    repo_path: &str,
    refs: &BranchComparisonRefs,
) -> Result<String, String> {
    run_git(
        repo_path,
        &[
            "diff",
            "--raw",
            "--find-renames",
            &refs.from_ref,
            &refs.head_sha,
        ],
    )
}

fn is_merge_base_comparison(comparison_mode: &str) -> bool {
    comparison_mode == "mergeBase" || comparison_mode == "merge-base"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_base_comparison_accepts_legacy_and_kebab_aliases() {
        assert!(is_merge_base_comparison("mergeBase"));
        assert!(is_merge_base_comparison("merge-base"));
        assert!(!is_merge_base_comparison("direct"));
    }
}
