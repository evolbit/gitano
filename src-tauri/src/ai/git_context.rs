use super::context_window::prompt_context_budget_chars;
use super::types::{LocalAiActionKind, LocalAiRunMetadata, LocalAiRunRequest};
use sha2::{Digest, Sha256};
use std::fs;
use std::process::Command;

const DIFF_CONTEXT_LINES: usize = 3;
const COMMIT_MESSAGE_DIFF_CONTEXT_LINES: usize = 1;

#[derive(Debug, Clone)]
pub struct LocalAiGitContext {
    pub action_kind: LocalAiActionKind,
    pub title: String,
    pub prompt_context: String,
    pub input_digest: String,
    pub metadata: LocalAiRunMetadata,
}

#[derive(Debug, Clone)]
pub struct LocalAiBranchReviewFileContexts {
    pub input_digest: String,
    pub metadata: LocalAiRunMetadata,
    pub blocks: Vec<LocalAiGitContext>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalAiCommitAnalysisContextStep {
    ResolvingCommit,
    ReadingCommitDiff,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalAiBranchContextStep {
    ResolvingRefs,
    DeterminingDiffBase,
    ReadingComparisonDiff,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BranchDiffOrder {
    Git,
    ReviewPriority,
}

pub fn build_git_context(
    request: &LocalAiRunRequest,
    context_window: usize,
) -> Result<LocalAiGitContext, String> {
    let raw = match request.action_kind {
        LocalAiActionKind::CommitMessage => staged_context(&request.repo_path)?,
        LocalAiActionKind::CommitAnalysis => {
            let sha = request
                .commit_sha
                .as_deref()
                .ok_or_else(|| "Commit SHA is required for commit analysis.".to_string())?;
            commit_context(&request.repo_path, sha)?
        }
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            let base_ref = request
                .base_ref
                .as_deref()
                .ok_or_else(|| "Base ref is required for branch analysis.".to_string())?;
            let head_ref = request
                .head_ref
                .as_deref()
                .ok_or_else(|| "Head ref is required for branch analysis.".to_string())?;
            branch_context(
                &request.repo_path,
                base_ref,
                head_ref,
                request.comparison_mode.as_deref().unwrap_or("direct"),
                request.action_kind,
            )?
        }
        LocalAiActionKind::MergeConflictSuggestions => conflict_context(&request.repo_path)?,
    };

    Ok(apply_context_budget(
        raw,
        prompt_context_budget_chars(request.action_kind, context_window),
    ))
}

pub fn build_external_agent_git_context(
    request: &LocalAiRunRequest,
) -> Result<LocalAiGitContext, String> {
    match request.action_kind {
        LocalAiActionKind::CommitMessage => staged_external_agent_context(&request.repo_path),
        LocalAiActionKind::CommitAnalysis => {
            let sha = request
                .commit_sha
                .as_deref()
                .ok_or_else(|| "Commit SHA is required for commit analysis.".to_string())?;
            commit_external_agent_context(&request.repo_path, sha)
        }
        LocalAiActionKind::BranchAnalysis | LocalAiActionKind::BranchReview => {
            let base_ref = request
                .base_ref
                .as_deref()
                .ok_or_else(|| "Base ref is required for branch analysis.".to_string())?;
            let head_ref = request
                .head_ref
                .as_deref()
                .ok_or_else(|| "Head ref is required for branch analysis.".to_string())?;
            branch_context_with_progress_and_order(
                &request.repo_path,
                base_ref,
                head_ref,
                request.comparison_mode.as_deref().unwrap_or("direct"),
                request.action_kind,
                if request.action_kind == LocalAiActionKind::BranchReview {
                    BranchDiffOrder::ReviewPriority
                } else {
                    BranchDiffOrder::Git
                },
                |_| {},
            )
        }
        LocalAiActionKind::MergeConflictSuggestions => {
            conflict_external_agent_context(&request.repo_path)
        }
    }
}

pub fn build_commit_analysis_context<F>(
    repo_path: &str,
    sha: &str,
    context_window: usize,
    on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiCommitAnalysisContextStep),
{
    Ok(apply_context_budget(
        commit_context_with_progress(repo_path, sha, on_step)?,
        prompt_context_budget_chars(LocalAiActionKind::CommitAnalysis, context_window),
    ))
}

pub fn build_external_agent_commit_analysis_context<F>(
    repo_path: &str,
    sha: &str,
    on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiCommitAnalysisContextStep),
{
    commit_external_agent_context_with_progress(repo_path, sha, on_step)
}

pub fn build_branch_context<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    action_kind: LocalAiActionKind,
    context_window: usize,
    on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiBranchContextStep),
{
    Ok(apply_context_budget(
        branch_context_with_progress(
            repo_path,
            base_ref,
            head_ref,
            comparison_mode,
            action_kind,
            on_step,
        )?,
        prompt_context_budget_chars(action_kind, context_window),
    ))
}

pub fn build_external_agent_branch_context<F>(
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
    branch_external_agent_context_with_progress(
        repo_path,
        base_ref,
        head_ref,
        comparison_mode,
        action_kind,
        on_step,
    )
}

fn staged_external_agent_context(repo_path: &str) -> Result<LocalAiGitContext, String> {
    let raw = run_git(
        repo_path,
        &["diff", "--cached", "--root", "--raw", "--find-renames"],
    )?;

    if raw.trim().is_empty() {
        return Err(
            "No staged changes are available for AI commit message generation.".to_string(),
        );
    }

    let stat = run_git(repo_path, &["diff", "--cached", "--root", "--stat"])?;
    let name_status = run_git(repo_path, &["diff", "--cached", "--root", "--name-status"])?;
    let tree = run_git(repo_path, &["write-tree"]).unwrap_or_default();
    let content = format!(
        "Action: Generate a commit message\nRepository: {}\nStaged tree: {}\n\nChanged files:\n{}\n\nStaged file summary:\n{}\n\nStaged fingerprint:\n{}\n\nInspect the staged changes yourself with read-only commands such as:\n- git diff --cached --name-status --find-renames\n- git diff --cached --stat --find-renames\n- git diff --cached --find-renames",
        repo_path,
        tree.trim(),
        name_status,
        stat,
        raw
    );
    let digest = digest_parts(&[
        "externalCommitMessage",
        tree.trim(),
        &name_status,
        &stat,
        &raw,
    ]);

    Ok(LocalAiGitContext {
        action_kind: LocalAiActionKind::CommitMessage,
        title: "staged changes".to_string(),
        prompt_context: content,
        input_digest: digest,
        metadata: empty_metadata(),
    })
}

fn commit_external_agent_context(repo_path: &str, sha: &str) -> Result<LocalAiGitContext, String> {
    commit_external_agent_context_with_progress(repo_path, sha, |_| {})
}

fn commit_external_agent_context_with_progress<F>(
    repo_path: &str,
    sha: &str,
    mut on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiCommitAnalysisContextStep),
{
    on_step(LocalAiCommitAnalysisContextStep::ResolvingCommit);
    let resolved_sha = run_git(repo_path, &["rev-parse", sha])?;
    on_step(LocalAiCommitAnalysisContextStep::ReadingCommitDiff);
    let stat = run_git(repo_path, &["show", "--stat", "--format=fuller", sha])?;
    let name_status = run_git(
        repo_path,
        &["show", "--format=", "--name-status", "--find-renames", sha],
    )?;
    let raw = run_git(
        repo_path,
        &["show", "--format=", "--raw", "--find-renames", sha],
    )?;

    if raw.trim().is_empty() {
        return Err("The selected commit has no diff context to analyze.".to_string());
    }

    let content = format!(
        "Action: Analyze a commit\nRepository: {}\nCommit: {}\n\nCommit metadata and summary:\n{}\n\nChanged files:\n{}\n\nCommit fingerprint:\n{}\n\nInspect the commit yourself with read-only commands such as:\n- git show --stat --find-renames {}\n- git show --format= --name-status --find-renames {}\n- git show --format= --find-renames -U3 {}",
        repo_path,
        resolved_sha.trim(),
        stat,
        name_status,
        raw,
        resolved_sha.trim(),
        resolved_sha.trim(),
        resolved_sha.trim()
    );
    let digest = digest_parts(&[
        "externalCommitAnalysis",
        resolved_sha.trim(),
        &name_status,
        &stat,
        &raw,
    ]);

    Ok(LocalAiGitContext {
        action_kind: LocalAiActionKind::CommitAnalysis,
        title: resolved_sha.trim().to_string(),
        prompt_context: content,
        input_digest: digest,
        metadata: empty_metadata(),
    })
}

struct BranchComparisonRefs {
    base_sha: String,
    head_sha: String,
    from_ref: String,
}

struct BranchDiffSummary {
    name_status: String,
    stat: String,
}

fn resolve_branch_comparison_refs<F>(
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

fn is_merge_base_comparison(comparison_mode: &str) -> bool {
    comparison_mode == "mergeBase" || comparison_mode == "merge-base"
}

fn read_branch_diff_summary(
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

fn read_branch_diff_fingerprint(
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

fn branch_external_agent_context_with_progress<F>(
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

pub fn build_branch_review_file_contexts<F>(
    repo_path: &str,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: &str,
    context_window: usize,
    on_step: F,
) -> Result<LocalAiBranchReviewFileContexts, String>
where
    F: FnMut(LocalAiBranchContextStep),
{
    build_branch_review_file_contexts_with_progress(
        repo_path,
        base_ref,
        head_ref,
        comparison_mode,
        context_window,
        on_step,
    )
}

fn staged_context(repo_path: &str) -> Result<LocalAiGitContext, String> {
    let diff = run_git(
        repo_path,
        &[
            "diff",
            "--cached",
            "--root",
            "--find-renames",
            &format!("-U{}", COMMIT_MESSAGE_DIFF_CONTEXT_LINES),
        ],
    )?;

    if diff.trim().is_empty() {
        return Err(
            "No staged changes are available for AI commit message generation.".to_string(),
        );
    }

    let stat = run_git(repo_path, &["diff", "--cached", "--root", "--stat"])?;
    let name_status = run_git(repo_path, &["diff", "--cached", "--root", "--name-status"])?;
    let tree = run_git(repo_path, &["write-tree"]).unwrap_or_default();
    let content = format!(
        "Action: Generate a commit message\nStaged tree: {}\n\nChanged files:\n{}\n\nStaged file summary:\n{}\n\nStaged diff:\n{}",
        tree.trim(),
        name_status,
        stat,
        diff
    );
    let digest = digest_parts(&["commitMessage", tree.trim(), &name_status, &stat, &diff]);

    Ok(LocalAiGitContext {
        action_kind: LocalAiActionKind::CommitMessage,
        title: "staged changes".to_string(),
        prompt_context: content,
        input_digest: digest,
        metadata: empty_metadata(),
    })
}

fn commit_context(repo_path: &str, sha: &str) -> Result<LocalAiGitContext, String> {
    commit_context_with_progress(repo_path, sha, |_| {})
}

fn commit_context_with_progress<F>(
    repo_path: &str,
    sha: &str,
    mut on_step: F,
) -> Result<LocalAiGitContext, String>
where
    F: FnMut(LocalAiCommitAnalysisContextStep),
{
    on_step(LocalAiCommitAnalysisContextStep::ResolvingCommit);
    let resolved_sha = run_git(repo_path, &["rev-parse", sha])?;
    on_step(LocalAiCommitAnalysisContextStep::ReadingCommitDiff);
    let stat = run_git(repo_path, &["show", "--stat", "--format=fuller", sha])?;
    let diff = run_git(
        repo_path,
        &[
            "show",
            "--format=",
            "--find-renames",
            &format!("-U{}", DIFF_CONTEXT_LINES),
            sha,
        ],
    )?;

    if diff.trim().is_empty() {
        return Err("The selected commit has no diff context to analyze.".to_string());
    }

    let content = format!(
        "Action: Analyze a commit\nCommit: {}\n\nCommit metadata and summary:\n{}\n\nCommit diff:\n{}",
        resolved_sha.trim(),
        stat,
        diff
    );
    let digest = digest_parts(&["commitAnalysis", resolved_sha.trim(), &diff]);

    Ok(LocalAiGitContext {
        action_kind: LocalAiActionKind::CommitAnalysis,
        title: resolved_sha.trim().to_string(),
        prompt_context: content,
        input_digest: digest,
        metadata: empty_metadata(),
    })
}

fn branch_context(
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

fn branch_context_with_progress<F>(
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

fn branch_context_with_progress_and_order<F>(
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

fn build_branch_review_file_contexts_with_progress<F>(
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

fn parse_name_status_paths(name_status: &str) -> Vec<String> {
    name_status
        .lines()
        .filter_map(|line| line.split('\t').next_back())
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn prioritized_branch_diff(
    repo_path: &str,
    from_ref: &str,
    head_sha: &str,
    name_status: &str,
) -> Result<String, String> {
    let mut file_paths = parse_name_status_paths(name_status)
        .into_iter()
        .enumerate()
        .collect::<Vec<_>>();
    file_paths.sort_by_key(|(index, path)| (review_path_priority(path), *index));

    let mut diffs = Vec::new();
    for (_, file_path) in file_paths {
        let diff = run_git(
            repo_path,
            &[
                "diff",
                "--find-renames",
                &format!("-U{}", DIFF_CONTEXT_LINES),
                from_ref,
                head_sha,
                "--",
                &file_path,
            ],
        )?;

        if !diff.trim().is_empty() {
            diffs.push(diff);
        }
    }

    Ok(diffs.join("\n"))
}

fn review_path_priority(path: &str) -> u8 {
    let lower = path.to_ascii_lowercase();

    if is_test_path(&lower) {
        return 1;
    }

    if is_source_path(&lower) {
        return 0;
    }

    if is_documentation_path(&lower) {
        return 4;
    }

    if is_config_path(&lower) {
        return 2;
    }

    3
}

fn is_source_path(path: &str) -> bool {
    let extension = path.rsplit('.').next().unwrap_or_default();
    path.starts_with("src/")
        || path.contains("/src/")
        || matches!(
            extension,
            "c" | "cc"
                | "cpp"
                | "cs"
                | "ex"
                | "exs"
                | "go"
                | "h"
                | "hpp"
                | "java"
                | "js"
                | "jsx"
                | "kt"
                | "php"
                | "py"
                | "rb"
                | "rs"
                | "scala"
                | "swift"
                | "ts"
                | "tsx"
                | "vue"
                | "svelte"
        )
}

fn is_test_path(path: &str) -> bool {
    path.contains("__tests__/")
        || path.contains("/tests/")
        || path.starts_with("tests/")
        || path.contains(".test.")
        || path.contains(".spec.")
}

fn is_config_path(path: &str) -> bool {
    matches!(
        path,
        "cargo.toml"
            | "cargo.lock"
            | "package.json"
            | "package-lock.json"
            | "pnpm-lock.yaml"
            | "yarn.lock"
            | "tsconfig.json"
            | "vite.config.ts"
            | "vite.config.js"
    ) || matches!(
        path.rsplit('.').next().unwrap_or_default(),
        "json" | "toml" | "yaml" | "yml"
    )
}

fn is_documentation_path(path: &str) -> bool {
    path.starts_with("docs/")
        || path.starts_with("openspec/")
        || path.ends_with(".md")
        || path.ends_with(".mdx")
        || path.ends_with(".txt")
}

fn branch_action_label(action_kind: LocalAiActionKind) -> &'static str {
    match action_kind {
        LocalAiActionKind::BranchReview => {
            "Action: Review changed code in a branch or PR-style comparison"
        }
        _ => "Action: Analyze a branch or PR-style comparison",
    }
}

fn conflict_external_agent_context(repo_path: &str) -> Result<LocalAiGitContext, String> {
    let files = run_git(repo_path, &["diff", "--name-only", "--diff-filter=U"])?;
    let file_paths: Vec<String> = files
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect();

    if file_paths.is_empty() {
        return Err("No merge conflicts are available for AI suggestions.".to_string());
    }

    let unmerged_index = run_git(repo_path, &["ls-files", "-u"])?;
    let content = format!(
        "Action: Suggest merge conflict resolutions\nRepository: {}\n\nConflicted files:\n{}\n\nUnmerged index fingerprint:\n{}\n\nInspect conflicts yourself with read-only commands such as:\n- git diff --name-only --diff-filter=U\n- git ls-files -u\n- git show :1:<path>\n- git show :2:<path>\n- git show :3:<path>\nYou may also read conflicted worktree files through ACP file reads. Do not modify files.",
        repo_path,
        file_paths.join("\n"),
        unmerged_index
    );
    let digest = digest_parts(&[
        "externalMergeConflictSuggestions",
        &file_paths.join("\0"),
        &unmerged_index,
    ]);

    Ok(LocalAiGitContext {
        action_kind: LocalAiActionKind::MergeConflictSuggestions,
        title: "merge conflicts".to_string(),
        prompt_context: content,
        input_digest: digest,
        metadata: empty_metadata(),
    })
}

fn conflict_context(repo_path: &str) -> Result<LocalAiGitContext, String> {
    let files = run_git(repo_path, &["diff", "--name-only", "--diff-filter=U"])?;
    let file_paths: Vec<String> = files
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect();

    if file_paths.is_empty() {
        return Err("No merge conflicts are available for AI suggestions.".to_string());
    }

    let mut sections = Vec::new();
    for file_path in &file_paths {
        let base = run_git(repo_path, &["show", &format!(":1:{}", file_path)]).unwrap_or_default();
        let ours = run_git(repo_path, &["show", &format!(":2:{}", file_path)]).unwrap_or_default();
        let theirs =
            run_git(repo_path, &["show", &format!(":3:{}", file_path)]).unwrap_or_default();
        let worktree =
            fs::read_to_string(format!("{}/{}", repo_path, file_path)).unwrap_or_default();

        sections.push(format!(
            "File: {}\n\nBase version:\n{}\n\nOurs version:\n{}\n\nTheirs version:\n{}\n\nCurrent conflicted worktree file:\n{}",
            file_path, base, ours, theirs, worktree
        ));
    }

    let context = format!(
        "Action: Suggest merge conflict resolutions\nConflicted files:\n{}\n\n{}",
        file_paths.join("\n"),
        sections.join("\n\n---\n\n")
    );
    let digest = digest_parts(&["mergeConflictSuggestions", &file_paths.join("\0"), &context]);

    Ok(LocalAiGitContext {
        action_kind: LocalAiActionKind::MergeConflictSuggestions,
        title: "merge conflicts".to_string(),
        prompt_context: context,
        input_digest: digest,
        metadata: empty_metadata(),
    })
}

fn apply_context_budget(context: LocalAiGitContext, max_chars: usize) -> LocalAiGitContext {
    let mut context = context;
    if context.prompt_context.len() <= max_chars {
        return context;
    }

    context
        .metadata
        .omitted_sections
        .push("Prompt context was truncated to fit the selected model budget.".to_string());
    context.prompt_context.truncate(max_chars);
    context.prompt_context.push_str(
        "\n\n[Context truncated by Gitano to fit the selected local model context window.]",
    );
    context.input_digest = digest_parts(&[
        context.action_kind.as_key(),
        &context.title,
        &context.prompt_context,
    ]);
    context
}

fn empty_metadata() -> LocalAiRunMetadata {
    LocalAiRunMetadata {
        omitted_files: vec![],
        omitted_sections: vec![],
    }
}

pub fn digest_parts(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update([0]);
    }
    format!("{:x}", hasher.finalize())
}

fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    Err(format!(
        "git {:?} failed: {}",
        args,
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::context_window::prompt_context_budget_chars;
    use crate::git::test_support::{commit_file, init_repo, run_git, write_file};

    #[test]
    fn staged_context_digest_changes_with_staged_diff() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");
        write_file(repo.path(), "file.txt", "one\ntwo\n");
        run_git(repo.path(), &["add", "file.txt"]);

        let first = staged_context(&repo.path().to_string_lossy()).unwrap();
        write_file(repo.path(), "file.txt", "one\ntwo\nthree\n");
        run_git(repo.path(), &["add", "file.txt"]);
        let second = staged_context(&repo.path().to_string_lossy()).unwrap();

        assert_ne!(first.input_digest, second.input_digest);
    }

    #[test]
    fn applies_context_budget_with_metadata() {
        let context = LocalAiGitContext {
            action_kind: LocalAiActionKind::CommitAnalysis,
            title: "test".to_string(),
            prompt_context: "a".repeat(20_000),
            input_digest: "input".to_string(),
            metadata: empty_metadata(),
        };

        let budgeted = apply_context_budget(context, 3_000);

        assert!(budgeted.prompt_context.len() < 20_000);
        assert!(!budgeted.metadata.omitted_sections.is_empty());
    }

    #[test]
    fn commit_message_context_uses_smaller_budget() {
        let budget = prompt_context_budget_chars(LocalAiActionKind::CommitMessage, 32_768);

        assert_eq!(budget, 18_000);
    }

    #[test]
    fn branch_review_context_reserves_prediction_budget_for_phi_context() {
        let budget = prompt_context_budget_chars(LocalAiActionKind::BranchReview, 131_072);

        assert_eq!(budget, (65_536 - 4_096) * 3);
    }

    #[test]
    fn commit_analysis_context_reports_real_steps() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");
        write_file(repo.path(), "file.txt", "one\ntwo\n");
        commit_file(repo.path(), "file.txt", "one\ntwo\n", "update");
        let repo_path = repo.path().to_string_lossy();
        let mut steps = Vec::new();

        let context = build_commit_analysis_context(&repo_path, "HEAD", 8_192, |step| {
            steps.push(step);
        })
        .unwrap();

        assert_eq!(
            steps,
            vec![
                LocalAiCommitAnalysisContextStep::ResolvingCommit,
                LocalAiCommitAnalysisContextStep::ReadingCommitDiff,
            ]
        );
        assert_eq!(context.action_kind, LocalAiActionKind::CommitAnalysis);
    }

    #[test]
    fn branch_review_context_reports_real_steps_and_uses_review_action() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");
        run_git(repo.path(), &["checkout", "-b", "feature"]);
        commit_file(repo.path(), "file.txt", "one\ntwo\n", "update");
        let repo_path = repo.path().to_string_lossy();
        let mut steps = Vec::new();

        let context = build_branch_context(
            &repo_path,
            "main",
            "feature",
            "direct",
            LocalAiActionKind::BranchReview,
            8_192,
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
    fn parses_name_status_paths_with_renames() {
        let paths = parse_name_status_paths("M\tsrc/app.ts\nR100\tsrc/old.ts\tsrc/new.ts\n");

        assert_eq!(paths, vec!["src/app.ts", "src/new.ts"]);
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

        let context = build_external_agent_branch_context(
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

        let context = build_external_agent_branch_context(
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

    #[test]
    fn external_staged_context_digest_changes_with_staged_fingerprint() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");
        write_file(repo.path(), "file.txt", "one\ntwo\n");
        run_git(repo.path(), &["add", "file.txt"]);
        let repo_path = repo.path().to_string_lossy();

        let first = staged_external_agent_context(&repo_path).unwrap();
        write_file(repo.path(), "file.txt", "one\ntwo\nthree\n");
        run_git(repo.path(), &["add", "file.txt"]);
        let second = staged_external_agent_context(&repo_path).unwrap();

        assert_ne!(first.input_digest, second.input_digest);
        assert!(!first.prompt_context.contains("diff --git"));
    }

    #[test]
    fn external_commit_context_omits_patch_content() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");
        commit_file(repo.path(), "file.txt", "one\ntwo\n", "update");
        let repo_path = repo.path().to_string_lossy();

        let context = commit_external_agent_context(&repo_path, "HEAD").unwrap();

        assert!(context.prompt_context.contains("git show --format="));
        assert!(context.prompt_context.contains("file.txt"));
        assert!(!context.prompt_context.contains("diff --git"));
        assert!(!context.prompt_context.contains("+two"));
    }

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

        let contexts = build_branch_review_file_contexts(
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
