use super::types::{LocalAiActionKind, LocalAiRunMetadata, LocalAiRunRequest};
use sha2::{Digest, Sha256};
use std::fs;
use std::process::Command;

const DIFF_CONTEXT_LINES: usize = 3;
const COMMIT_MESSAGE_DIFF_CONTEXT_LINES: usize = 1;
const COMMIT_MESSAGE_MAX_CONTEXT_CHARS: usize = 18_000;

#[derive(Debug, Clone)]
pub struct LocalAiGitContext {
    pub action_kind: LocalAiActionKind,
    pub title: String,
    pub prompt_context: String,
    pub input_digest: String,
    pub metadata: LocalAiRunMetadata,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalAiCommitAnalysisContextStep {
    ResolvingCommit,
    ReadingCommitDiff,
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
        LocalAiActionKind::BranchAnalysis => {
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
            )?
        }
        LocalAiActionKind::MergeConflictSuggestions => conflict_context(&request.repo_path)?,
    };

    Ok(apply_context_budget(
        raw,
        context_budget_chars(request.action_kind, context_window),
    ))
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
        context_budget_chars(LocalAiActionKind::CommitAnalysis, context_window),
    ))
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
) -> Result<LocalAiGitContext, String> {
    let base_sha = run_git(repo_path, &["rev-parse", base_ref])?;
    let head_sha = run_git(repo_path, &["rev-parse", head_ref])?;
    let from_ref = if comparison_mode == "mergeBase" || comparison_mode == "merge-base" {
        run_git(repo_path, &["merge-base", base_ref, head_ref])?
    } else {
        base_sha.clone()
    };
    let from_ref = from_ref.trim().to_string();
    let head_sha = head_sha.trim().to_string();
    let stat = run_git(repo_path, &["diff", "--stat", &from_ref, &head_sha])?;
    let diff = run_git(
        repo_path,
        &[
            "diff",
            "--find-renames",
            &format!("-U{}", DIFF_CONTEXT_LINES),
            &from_ref,
            &head_sha,
        ],
    )?;

    if diff.trim().is_empty() {
        return Err("The selected branch comparison has no diff context to analyze.".to_string());
    }

    let content = format!(
        "Action: Analyze a branch or PR-style comparison\nBase ref: {} ({})\nHead ref: {} ({})\nComparison mode: {}\nEffective diff base: {}\n\nChanged file summary:\n{}\n\nComparison diff:\n{}",
        base_ref,
        base_sha.trim(),
        head_ref,
        head_sha,
        comparison_mode,
        from_ref,
        stat,
        diff
    );
    let digest = digest_parts(&[
        "branchAnalysis",
        &from_ref,
        &head_sha,
        comparison_mode,
        &diff,
    ]);

    Ok(LocalAiGitContext {
        action_kind: LocalAiActionKind::BranchAnalysis,
        title: format!("{}...{}", base_ref, head_ref),
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

fn apply_context_budget(mut context: LocalAiGitContext, max_chars: usize) -> LocalAiGitContext {
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

fn context_budget_chars(action_kind: LocalAiActionKind, context_window: usize) -> usize {
    let model_budget = context_window.saturating_mul(3).max(8_000);

    match action_kind {
        LocalAiActionKind::CommitMessage => model_budget.min(COMMIT_MESSAGE_MAX_CONTEXT_CHARS),
        LocalAiActionKind::CommitAnalysis
        | LocalAiActionKind::BranchAnalysis
        | LocalAiActionKind::MergeConflictSuggestions => model_budget,
    }
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
        let budget = context_budget_chars(LocalAiActionKind::CommitMessage, 32_768);

        assert_eq!(budget, COMMIT_MESSAGE_MAX_CONTEXT_CHARS);
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
}
