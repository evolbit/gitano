use super::super::context_window::prompt_context_budget_chars;
use super::super::types::LocalAiActionKind;
use super::branch_refs::{read_branch_diff_summary, resolve_branch_comparison_refs};
use super::review_order::parse_name_status_paths;
use super::{
    apply_context_budget, digest_parts, empty_metadata, run_git, LocalAiBranchContextStep,
    LocalAiBranchReviewFileContexts, LocalAiGitContext, DIFF_CONTEXT_LINES,
};

pub(super) fn build_branch_review_file_contexts_with_progress<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    context_window: usize,
    mut on_step: F,
) -> Result<LocalAiBranchReviewFileContexts, String>
where
    F: FnMut(LocalAiBranchContextStep),
{
    let refs = resolve_branch_comparison_refs(
        repo_path,
        base_ref,
        head_ref,
        comparison_mode,
        &mut on_step,
    )?;
    on_step(LocalAiBranchContextStep::ReadingComparisonDiff);
    let summary = read_branch_diff_summary(repo_path, &refs)?;
    let file_paths = parse_name_status_paths(&summary.name_status);

    if file_paths.is_empty() {
        return Err("The selected branch comparison has no diff context to analyze.".to_string());
    }

    let mut blocks = Vec::new();
    let max_chars = prompt_context_budget_chars(LocalAiActionKind::BranchReview, context_window);

    for file_path in &file_paths {
        let diff = run_git(
            repo_path,
            &[
                "diff",
                "--find-renames",
                &format!("-U{}", DIFF_CONTEXT_LINES),
                &refs.from_ref,
                &refs.head_sha,
                "--",
                file_path,
            ],
        )?;

        if diff.trim().is_empty() {
            continue;
        }

        let content = format!(
            "Action: Review changed code in one segmented branch-review file block\nBase ref: {} ({})\nHead ref: {} ({})\nComparison mode: {}\nEffective diff base: {}\nReview scope: file-level block\nCurrent review file: {}\n\nAll changed files in this comparison:\n{}\n\nChanged file summary:\n{}\n\nFile diff block:\n{}",
            base_ref,
            refs.base_sha.trim(),
            head_ref,
            refs.head_sha,
            comparison_mode,
            refs.from_ref,
            file_path,
            &summary.name_status,
            &summary.stat,
            diff
        );
        let digest = digest_parts(&[
            "branchReviewFileBlock",
            &refs.from_ref,
            &refs.head_sha,
            comparison_mode,
            file_path,
            &diff,
        ]);
        let context = LocalAiGitContext {
            action_kind: LocalAiActionKind::BranchReview,
            title: file_path.clone(),
            prompt_context: content,
            input_digest: digest,
            metadata: empty_metadata(),
        };

        blocks.push(apply_context_budget(context, max_chars));
    }

    if blocks.is_empty() {
        return Err("The selected branch comparison has no diff context to analyze.".to_string());
    }

    let block_digests = blocks
        .iter()
        .map(|block| block.input_digest.as_str())
        .collect::<Vec<_>>()
        .join("\0");
    let mut metadata = empty_metadata();
    for block in &blocks {
        metadata
            .omitted_files
            .extend(block.metadata.omitted_files.iter().cloned());
        metadata
            .omitted_sections
            .extend(block.metadata.omitted_sections.iter().cloned());
    }

    Ok(LocalAiBranchReviewFileContexts {
        input_digest: digest_parts(&[
            "branchReviewFileBlocks",
            &refs.from_ref,
            &refs.head_sha,
            comparison_mode,
            &summary.name_status,
            &summary.stat,
            &block_digests,
        ]),
        metadata,
        blocks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};

    #[test]
    fn branch_review_file_contexts_split_changed_files() {
        let repo = init_repo();
        commit_file(repo.path(), "a.txt", "one\n", "initial");
        commit_file(repo.path(), "b.txt", "one\n", "add b");
        run_git(repo.path(), &["checkout", "-b", "feature"]);
        commit_file(repo.path(), "a.txt", "one\ntwo\n", "update a");
        commit_file(repo.path(), "b.txt", "one\ntwo\n", "update b");
        let repo_path = repo.path().to_string_lossy();
        let mut steps = Vec::new();

        let contexts = build_branch_review_file_contexts_with_progress(
            &repo_path,
            "main",
            "feature",
            "direct",
            8_192,
            |step| steps.push(step),
        )
        .unwrap();

        assert_eq!(contexts.blocks.len(), 2);
        assert!(contexts
            .blocks
            .iter()
            .all(|block| block.action_kind == LocalAiActionKind::BranchReview));
        assert!(contexts
            .blocks
            .iter()
            .any(|block| block.prompt_context.contains("Current review file: a.txt")));
        assert!(contexts
            .blocks
            .iter()
            .any(|block| block.prompt_context.contains("Current review file: b.txt")));
        assert_eq!(
            steps,
            vec![
                LocalAiBranchContextStep::ResolvingRefs,
                LocalAiBranchContextStep::DeterminingDiffBase,
                LocalAiBranchContextStep::ReadingComparisonDiff,
            ]
        );
    }
}
