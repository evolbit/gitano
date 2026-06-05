use super::super::types::LocalAiActionKind;
use super::{
    digest_parts, empty_metadata, run_git, LocalAiGitContext, COMMIT_MESSAGE_DIFF_CONTEXT_LINES,
};

pub(super) fn staged_external_agent_context(repo_path: &str) -> Result<LocalAiGitContext, String> {
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
        conflict_candidate_input: None,
    })
}

pub(super) fn staged_context(repo_path: &str) -> Result<LocalAiGitContext, String> {
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
        conflict_candidate_input: None,
    })
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
}
