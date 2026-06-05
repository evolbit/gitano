use super::super::types::{
    LocalAiActionKind, LocalAiConflictCandidateInput, LocalAiConflictScope,
};
use super::{digest_parts, empty_metadata, run_git, LocalAiGitContext};
use crate::git::conflicts::get_merge_conflict_file;
use crate::git::conflicts::types::{
    GitConflictContentKind, GitConflictFileDetail, GitConflictRegion, GitConflictSizeClass,
    GitConflictVersion,
};
use std::fs;

const REGION_CONTEXT_LINES: usize = 24;
const REGION_SIDE_TEXT_LIMIT: usize = 20_000;
const FILE_SIDE_TEXT_LIMIT: usize = 40_000;

pub(super) fn conflict_external_agent_context(
    repo_path: &str,
    scope: Option<&LocalAiConflictScope>,
) -> Result<LocalAiGitContext, String> {
    if let Some(scope) = scope {
        return scoped_conflict_context(repo_path, scope, true);
    }

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
        conflict_candidate_input: None,
    })
}

pub(super) fn conflict_context(
    repo_path: &str,
    scope: Option<&LocalAiConflictScope>,
) -> Result<LocalAiGitContext, String> {
    if let Some(scope) = scope {
        return scoped_conflict_context(repo_path, scope, false);
    }

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
        conflict_candidate_input: None,
    })
}

fn scoped_conflict_context(
    repo_path: &str,
    scope: &LocalAiConflictScope,
    external: bool,
) -> Result<LocalAiGitContext, String> {
    let detail = get_merge_conflict_file(repo_path.to_string(), scope.file_path().to_string())?;
    if detail.result.content_kind != GitConflictContentKind::Text {
        return Err("AI conflict fixes are only available for text conflicts.".to_string());
    }

    let mut metadata = empty_metadata();
    let context = match scope {
        LocalAiConflictScope::Region { region_id, .. } => {
            let region = detail
                .regions
                .iter()
                .find(|region| region.id == *region_id)
                .ok_or_else(|| "Selected conflict region is no longer available.".to_string())?;
            region_candidate_context(repo_path, &detail, region, external, &mut metadata)?
        }
        LocalAiConflictScope::File { .. } => {
            if file_scope_is_too_large(&detail) {
                return Err(
                    "File-wide AI is disabled for very large conflict files. Select one conflict region instead."
                        .to_string(),
                );
            }
            file_candidate_context(repo_path, &detail, external, &mut metadata)?
        }
    };
    let digest = digest_parts(&[
        if external {
            "externalMergeConflictCandidate"
        } else {
            "mergeConflictCandidate"
        },
        scope.file_path(),
        &scope_digest(scope),
        &detail.signatures.index_signature,
        &detail.signatures.result_signature,
        &context,
    ]);

    Ok(LocalAiGitContext {
        action_kind: LocalAiActionKind::MergeConflictSuggestions,
        title: format!("merge conflict {}", scope.file_path()),
        prompt_context: context,
        input_digest: digest,
        metadata,
        conflict_candidate_input: Some(LocalAiConflictCandidateInput {
            scope: scope.clone(),
            signatures: detail.signatures,
        }),
    })
}

fn region_candidate_context(
    repo_path: &str,
    detail: &GitConflictFileDetail,
    region: &GitConflictRegion,
    external: bool,
    metadata: &mut super::super::types::LocalAiRunMetadata,
) -> Result<String, String> {
    let result_text = detail
        .result
        .text
        .as_deref()
        .ok_or_else(|| "Result content is not available for AI conflict fix.".to_string())?;
    let inspection = external_read_only_instructions(repo_path, &detail.path, external);

    Ok(format!(
        "Action: Generate one reviewable merge conflict fix candidate\nRepository: {}\nTarget file: {}\nTarget scope: region\nTarget region id: {}\nInput conflict signature: {}\nInput result signature: {}\nConflict kinds: {}\n\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n\nRequirements:\n- Return a replacement for only the selected result conflict region.\n- Do not include conflict marker lines unless they belong in the final resolved file.\n- Do not modify files or mark the conflict resolved.",
        repo_path,
        detail.path,
        region.id,
        detail.signatures.index_signature,
        detail.signatures.result_signature,
        conflict_kind_list(detail),
        inspection,
        version_section("Base", detail.base.as_ref(), REGION_SIDE_TEXT_LIMIT, metadata),
        version_section("Current", detail.current.as_ref(), REGION_SIDE_TEXT_LIMIT, metadata),
        version_section("Incoming", detail.incoming.as_ref(), REGION_SIDE_TEXT_LIMIT, metadata),
        result_region_section(result_text, region),
    ))
}

fn file_candidate_context(
    repo_path: &str,
    detail: &GitConflictFileDetail,
    external: bool,
    metadata: &mut super::super::types::LocalAiRunMetadata,
) -> Result<String, String> {
    let result_text = detail
        .result
        .text
        .as_deref()
        .ok_or_else(|| "Result content is not available for AI conflict fix.".to_string())?;
    let inspection = external_read_only_instructions(repo_path, &detail.path, external);

    Ok(format!(
        "Action: Generate one reviewable full-file merge conflict fix candidate\nRepository: {}\nTarget file: {}\nTarget scope: file\nInput conflict signature: {}\nInput result signature: {}\nConflict kinds: {}\n\n{}\n\n{}\n\n{}\n\n{}\n\nResult worktree content:\n{}\n\nRequirements:\n- Return the full resolved result file content.\n- Do not leave conflict marker lines unless they belong in the final resolved file.\n- Do not modify files or mark the conflict resolved.",
        repo_path,
        detail.path,
        detail.signatures.index_signature,
        detail.signatures.result_signature,
        conflict_kind_list(detail),
        inspection,
        version_section("Base", detail.base.as_ref(), FILE_SIDE_TEXT_LIMIT, metadata),
        version_section("Current", detail.current.as_ref(), FILE_SIDE_TEXT_LIMIT, metadata),
        version_section("Incoming", detail.incoming.as_ref(), FILE_SIDE_TEXT_LIMIT, metadata),
        bounded_text(
            "Result worktree content",
            result_text,
            FILE_SIDE_TEXT_LIMIT,
            metadata,
        ),
    ))
}

fn external_read_only_instructions(repo_path: &str, file_path: &str, external: bool) -> String {
    if !external {
        return "Use only the conflict context below.".to_string();
    }

    format!(
        "Inspect with read-only commands only. Useful commands:\n- git -C {} show :1:{}\n- git -C {} show :2:{}\n- git -C {} show :3:{}\n- git -C {} diff -- {}\nDo not modify files.",
        repo_path, file_path, repo_path, file_path, repo_path, file_path, repo_path, file_path
    )
}

fn version_section(
    label: &str,
    version: Option<&GitConflictVersion>,
    limit: usize,
    metadata: &mut super::super::types::LocalAiRunMetadata,
) -> String {
    let Some(version) = version else {
        return format!("{label} version: unavailable");
    };
    if version.content_kind != GitConflictContentKind::Text {
        return format!("{label} version: {:?}", version.content_kind);
    }
    let Some(text) = version.text.as_deref() else {
        return format!("{label} version: unavailable");
    };

    format!("{label} version:\n{}", bounded_text(label, text, limit, metadata))
}

fn bounded_text(
    label: &str,
    text: &str,
    limit: usize,
    metadata: &mut super::super::types::LocalAiRunMetadata,
) -> String {
    if text.chars().count() <= limit {
        return text.to_string();
    }

    metadata.omitted_sections.push(format!(
        "{label} content was truncated for scoped conflict AI context."
    ));
    let mut truncated = text.chars().take(limit).collect::<String>();
    truncated.push_str("\n[truncated by Gitano]");
    truncated
}

fn result_region_section(result_text: &str, region: &GitConflictRegion) -> String {
    let lines = result_text.lines().collect::<Vec<_>>();
    let start_index = region
        .result_start_line
        .saturating_sub(REGION_CONTEXT_LINES + 1);
    let end_line = (region.result_end_line + REGION_CONTEXT_LINES).min(lines.len());
    let rows = lines
        .iter()
        .enumerate()
        .skip(start_index)
        .take(end_line.saturating_sub(start_index))
        .map(|(index, line)| format!("{:>6}: {}", index + 1, line))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "Selected result region lines {}-{} with nearby result context:\n{}",
        region.result_start_line, region.result_end_line, rows
    )
}

fn file_scope_is_too_large(detail: &GitConflictFileDetail) -> bool {
    [&detail.base, &detail.current, &detail.incoming]
        .into_iter()
        .filter_map(|version| version.as_ref())
        .chain(std::iter::once(&detail.result))
        .any(|version| version.size.size_class == GitConflictSizeClass::VeryLarge)
}

fn conflict_kind_list(detail: &GitConflictFileDetail) -> String {
    detail
        .conflict_kinds
        .iter()
        .map(|kind| format!("{kind:?}"))
        .collect::<Vec<_>>()
        .join(", ")
}

fn scope_digest(scope: &LocalAiConflictScope) -> String {
    match scope {
        LocalAiConflictScope::Region {
            file_path,
            region_id,
        } => format!("region:{file_path}:{region_id}"),
        LocalAiConflictScope::File { file_path } => format!("file:{file_path}"),
    }
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
    use crate::git::conflicts::types::{
        GitConflictLineEnding, GitConflictSignatures, GitConflictSide, GitConflictSize,
    };
    use crate::git::test_support::{commit_file, init_repo, run_git};
    use std::path::Path;
    use std::process::Command;

    #[test]
    fn conflicted_file_paths_trims_blank_lines() {
        let paths = conflicted_file_paths("\n src/app.rs \n\nREADME.md\n");

        assert_eq!(paths, vec!["src/app.rs", "README.md"]);
    }

    fn run_git_expect_failure(repo_path: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .args(args)
            .output()
            .expect("git command should run");

        assert!(!output.status.success(), "git {:?} should fail", args);
    }

    fn create_both_modified_conflict() -> tempfile::TempDir {
        let repo = init_repo();
        commit_file(repo.path(), "target.txt", "one\nbase\n", "base");
        run_git(repo.path(), &["checkout", "-b", "incoming"]);
        commit_file(repo.path(), "target.txt", "one\nincoming\n", "incoming");
        run_git(repo.path(), &["checkout", "main"]);
        commit_file(repo.path(), "target.txt", "one\ncurrent\n", "current");
        run_git_expect_failure(repo.path(), &["merge", "incoming"]);
        repo
    }

    #[test]
    fn scoped_region_context_uses_conflict_detail_signatures() {
        let repo = create_both_modified_conflict();
        let context = conflict_context(
            &repo.path().to_string_lossy(),
            Some(&LocalAiConflictScope::Region {
                file_path: "target.txt".to_string(),
                region_id: "conflict-1".to_string(),
            }),
        )
        .expect("scoped context should build");

        let input = context
            .conflict_candidate_input
            .expect("candidate input should be captured");

        assert!(context.prompt_context.contains("Target scope: region"));
        assert!(context.prompt_context.contains("Target region id: conflict-1"));
        assert!(context.prompt_context.contains("Input conflict signature:"));
        assert_eq!(input.scope.file_path(), "target.txt");
        assert!(input.signatures.index_signature.starts_with("sha256:"));
    }

    #[test]
    fn external_scoped_context_keeps_read_only_instructions() {
        let repo = create_both_modified_conflict();
        let context = conflict_external_agent_context(
            &repo.path().to_string_lossy(),
            Some(&LocalAiConflictScope::File {
                file_path: "target.txt".to_string(),
            }),
        )
        .expect("external scoped context should build");

        assert!(context.prompt_context.contains("Do not modify files."));
        assert!(context.prompt_context.contains("Target scope: file"));
        assert!(context.conflict_candidate_input.is_some());
    }

    #[test]
    fn file_scope_rejects_very_large_conflicts() {
        let detail = GitConflictFileDetail {
            path: "large.txt".to_string(),
            status: crate::git::types::ChangeType::Conflicted,
            base: None,
            current: None,
            incoming: None,
            result: GitConflictVersion {
                side: GitConflictSide::Result,
                content_kind: GitConflictContentKind::Text,
                text: Some("content".to_string()),
                size: GitConflictSize {
                    byte_size: 11_000_000,
                    line_count: 1,
                    size_class: GitConflictSizeClass::VeryLarge,
                },
                line_ending: GitConflictLineEnding::Lf,
                has_final_newline: false,
            },
            regions: Vec::new(),
            conflict_kinds: Vec::new(),
            content_kind: GitConflictContentKind::Text,
            signatures: GitConflictSignatures {
                index_signature: "index".to_string(),
                result_signature: "result".to_string(),
            },
        };

        assert!(file_scope_is_too_large(&detail));
    }
}
