use super::super::types::LocalAiActionKind;
use super::{
    digest_parts, empty_metadata, run_git, LocalAiCommitAnalysisContextStep, LocalAiGitContext,
    DIFF_CONTEXT_LINES,
};

pub(super) fn commit_external_agent_context(
    repo_path: &str,
    sha: &str,
) -> Result<LocalAiGitContext, String> {
    commit_external_agent_context_with_progress(repo_path, sha, |_| {})
}

pub(super) fn commit_external_agent_context_with_progress<F>(
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
        conflict_candidate_input: None,
    })
}

pub(super) fn commit_context(repo_path: &str, sha: &str) -> Result<LocalAiGitContext, String> {
    commit_context_with_progress(repo_path, sha, |_| {})
}

pub(super) fn commit_context_with_progress<F>(
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
        conflict_candidate_input: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, write_file};

    #[test]
    fn commit_analysis_context_reports_real_steps() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "one\n", "initial");
        write_file(repo.path(), "file.txt", "one\ntwo\n");
        commit_file(repo.path(), "file.txt", "one\ntwo\n", "update");
        let repo_path = repo.path().to_string_lossy();
        let mut steps = Vec::new();

        let context = commit_context_with_progress(&repo_path, "HEAD", |step| {
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
}
