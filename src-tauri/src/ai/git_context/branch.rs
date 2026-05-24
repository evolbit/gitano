use super::super::types::LocalAiActionKind;
use super::branch_refs::{
    read_branch_diff_fingerprint, read_branch_diff_summary, resolve_branch_comparison_refs,
};
use super::review_order::prioritized_branch_diff;
use super::{
    digest_parts, empty_metadata, run_git, BranchDiffOrder, LocalAiBranchContextStep,
    LocalAiGitContext, DIFF_CONTEXT_LINES,
};

pub(super) fn branch_external_agent_context_with_progress<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    action_kind: LocalAiActionKind,
    mut on_step: F,
) -> Result<LocalAiGitContext, String>
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
    let raw = read_branch_diff_fingerprint(repo_path, &refs)?;

    if raw.trim().is_empty() {
        return Err("The selected branch comparison has no diff context to analyze.".to_string());
    }

    let review_instruction = if action_kind == LocalAiActionKind::BranchReview {
        "\nFor branch review, inspect source, test, and config files first. Anchor findings to changed diff lines from commands you run."
    } else {
        ""
    };
    let content = format!(
        "{}\nRepository: {}\nBase ref: {} ({})\nHead ref: {} ({})\nComparison mode: {}\nEffective diff base: {}\n\nChanged files:\n{}\n\nChanged file summary:\n{}\n\nComparison fingerprint:\n{}\n\nInspect the comparison yourself with read-only commands such as:\n- git diff --name-status {} {}\n- git diff --stat {} {}\n- git diff --find-renames -U3 {} {}\n- git diff --find-renames -U3 {} {} -- <path>{}",
        branch_action_label(action_kind),
        repo_path,
        base_ref,
        refs.base_sha.trim(),
        head_ref,
        refs.head_sha,
        comparison_mode,
        refs.from_ref,
        &summary.name_status,
        &summary.stat,
        raw,
        refs.from_ref,
        refs.head_sha,
        refs.from_ref,
        refs.head_sha,
        refs.from_ref,
        refs.head_sha,
        refs.from_ref,
        refs.head_sha,
        review_instruction
    );
    let digest = digest_parts(&[
        "externalBranchContext",
        action_kind.as_key(),
        base_ref,
        head_ref,
        &refs.base_sha,
        &refs.from_ref,
        &refs.head_sha,
        comparison_mode,
        &summary.name_status,
        &summary.stat,
        &raw,
    ]);

    Ok(LocalAiGitContext {
        action_kind,
        title: format!("{}...{}", base_ref, head_ref),
        prompt_context: content,
        input_digest: digest,
        metadata: empty_metadata(),
    })
}

pub(super) fn branch_context(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    action_kind: LocalAiActionKind,
) -> Result<LocalAiGitContext, String> {
    branch_context_with_progress(
        repo_path,
        base_ref,
        head_ref,
        comparison_mode,
        action_kind,
        |_| {},
    )
}

pub(super) fn branch_context_with_progress<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    action_kind: LocalAiActionKind,
    on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiBranchContextStep),
{
    branch_context_with_progress_and_order(
        repo_path,
        base_ref,
        head_ref,
        comparison_mode,
        action_kind,
        BranchDiffOrder::Git,
        on_step,
    )
}

pub(super) fn branch_context_with_progress_and_order<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    action_kind: LocalAiActionKind,
    diff_order: BranchDiffOrder,
    mut on_step: F,
) -> Result<LocalAiGitContext, String>
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
    let diff = match diff_order {
        BranchDiffOrder::Git => run_git(
            repo_path,
            &[
                "diff",
                "--find-renames",
                &format!("-U{}", DIFF_CONTEXT_LINES),
                &refs.from_ref,
                &refs.head_sha,
            ],
        )?,
        BranchDiffOrder::ReviewPriority => prioritized_branch_diff(
            repo_path,
            &refs.from_ref,
            &refs.head_sha,
            &summary.name_status,
        )?,
    };

    if diff.trim().is_empty() {
        return Err("The selected branch comparison has no diff context to analyze.".to_string());
    }

    let content = format!(
        "{}\nBase ref: {} ({})\nHead ref: {} ({})\nComparison mode: {}\nEffective diff base: {}\n\nChanged files:\n{}\n\nChanged file summary:\n{}\n\nComparison diff:\n{}",
        branch_action_label(action_kind),
        base_ref,
        refs.base_sha.trim(),
        head_ref,
        refs.head_sha,
        comparison_mode,
        refs.from_ref,
        &summary.name_status,
        &summary.stat,
        diff
    );
    let digest = digest_parts(&[
        action_kind.as_key(),
        &refs.from_ref,
        &refs.head_sha,
        comparison_mode,
        &diff,
    ]);

    Ok(LocalAiGitContext {
        action_kind,
        title: format!("{}...{}", base_ref, head_ref),
        prompt_context: content,
        input_digest: digest,
        metadata: empty_metadata(),
    })
}

fn branch_action_label(action_kind: LocalAiActionKind) -> &'static str {
    match action_kind {
        LocalAiActionKind::BranchReview => {
            "Action: Review changed code in a branch or PR-style comparison"
        }
        _ => "Action: Analyze a branch or PR-style comparison",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};

    #[test]
    fn branch_review_context_reports_real_steps_and_uses_review_action() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");
        run_git(repo.path(), &["checkout", "-b", "feature"]);
        commit_file(repo.path(), "file.txt", "one\ntwo\n", "update");
        let repo_path = repo.path().to_string_lossy();
        let mut steps = Vec::new();

        let context = branch_context_with_progress(
            &repo_path,
            "main",
            "feature",
            "direct",
            LocalAiActionKind::BranchReview,
            |step| steps.push(step),
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                LocalAiBranchContextStep::ResolvingRefs,
                LocalAiBranchContextStep::DeterminingDiffBase,
                LocalAiBranchContextStep::ReadingComparisonDiff,
            ]
        );
        assert_eq!(context.action_kind, LocalAiActionKind::BranchReview);
        assert!(context.prompt_context.contains("Review changed code"));
    }

    #[test]
    fn external_branch_review_context_uses_descriptors_without_diff_hunks() {
        let repo = init_repo();
        commit_file(
            repo.path(),
            "src/app.rs",
            "pub fn value() -> u8 { 1 }\n",
            "add src",
        );
        commit_file(
            repo.path(),
            "openspec/specs/feature/spec.md",
            "old\n",
            "add spec",
        );
        run_git(repo.path(), &["checkout", "-b", "feature"]);
        commit_file(
            repo.path(),
            "openspec/specs/feature/spec.md",
            "old\nnew docs\n",
            "update spec",
        );
        commit_file(
            repo.path(),
            "src/app.rs",
            "pub fn value() -> u8 { 2 }\n",
            "update src",
        );
        let repo_path = repo.path().to_string_lossy();

        let context = branch_external_agent_context_with_progress(
            &repo_path,
            "main",
            "feature",
            "direct",
            LocalAiActionKind::BranchReview,
            |_| {},
        )
        .unwrap();

        assert!(context.prompt_context.contains("Base ref: main"));
        assert!(context.prompt_context.contains("Head ref: feature"));
        assert!(context
            .prompt_context
            .contains("git diff --find-renames -U3"));
        assert!(context.prompt_context.contains("src/app.rs"));
        assert!(context
            .prompt_context
            .contains("openspec/specs/feature/spec.md"));
        assert!(!context.prompt_context.contains("diff --git"));
        assert!(!context.prompt_context.contains("pub fn value()"));
    }

    #[test]
    fn external_branch_context_is_lightweight_even_for_large_diffs() {
        let repo = init_repo();
        commit_file(
            repo.path(),
            "src/large.rs",
            &format!("{}\n", "a".repeat(20_000)),
            "add large",
        );
        run_git(repo.path(), &["checkout", "-b", "feature"]);
        commit_file(
            repo.path(),
            "src/large.rs",
            &format!("{}\n", "b".repeat(20_000)),
            "update large",
        );
        let repo_path = repo.path().to_string_lossy();

        let context = branch_external_agent_context_with_progress(
            &repo_path,
            "main",
            "feature",
            "direct",
            LocalAiActionKind::BranchReview,
            |_| {},
        )
        .unwrap();

        assert!(context.prompt_context.len() < 10_000);
        assert!(context.metadata.omitted_sections.is_empty());
        assert!(!context.prompt_context.contains("diff --git"));
        assert!(!context.prompt_context.contains(&"b".repeat(200)));
        assert!(!context
            .prompt_context
            .contains("Context truncated by Gitano"));
    }
}
