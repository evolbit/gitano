use super::super::types::LocalAiActionKind;
use super::{digest_parts, empty_metadata, run_git, LocalAiGitContext};
use std::fs;

pub(super) fn conflict_external_agent_context(
    repo_path: &str,
) -> Result<LocalAiGitContext, String> {
    let files = run_git(repo_path, &["diff", "--name-only", "--diff-filter=U"])?;
    let file_paths = conflicted_file_paths(&files);

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

pub(super) fn conflict_context(repo_path: &str) -> Result<LocalAiGitContext, String> {
    let files = run_git(repo_path, &["diff", "--name-only", "--diff-filter=U"])?;
    let file_paths = conflicted_file_paths(&files);

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

fn conflicted_file_paths(files: &str) -> Vec<String> {
    files
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conflicted_file_paths_trims_blank_lines() {
        let paths = conflicted_file_paths("\n src/app.rs \n\nREADME.md\n");

        assert_eq!(paths, vec!["src/app.rs", "README.md"]);
    }
}
