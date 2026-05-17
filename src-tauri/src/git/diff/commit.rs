use super::parse_unified_diff;
use crate::git::types::*;
use git2::Repository;
use std::process::Command;

fn diff_delta_path(delta: &git2::DiffDelta<'_>) -> Option<String> {
    delta
        .new_file()
        .path()
        .or_else(|| delta.old_file().path())
        .and_then(|path| path.to_str())
        .map(ToString::to_string)
}

fn run_git_diff(path: &str, args: &[String]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .arg("diff")
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    Err(format!(
        "git diff failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

pub fn get_commit_file_diff(
    path: String,
    sha: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    // Check whether the file exists in the commit
    let show_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("show")
        .arg(format!("{}:./{}", sha, file_path))
        .output();

    match show_output {
        Ok(output) => {
            let file_content = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

            // Check whether the file exists in the parent commit
            let parent_show_output = Command::new("git")
                .arg("-C")
                .arg(&path)
                .arg("show")
                .arg(format!("{}^:./{}", sha, file_path))
                .output();

            match parent_show_output {
                Ok(_) => {
                    // The file exists in both commits, get the regular diff
                    let diff_output = Command::new("git")
                        .arg("-C")
                        .arg(&path)
                        .arg("diff")
                        .arg(format!("-U{}", context))
                        .arg(format!("{}^", sha))
                        .arg(&sha)
                        .arg("--")
                        .arg(&file_path)
                        .output()
                        .map_err(|e| e.to_string())?;
                    let diff = String::from_utf8_lossy(&diff_output.stdout);

                    if diff.trim().is_empty() {
                        return Ok(vec![]); // No changes
                    }

                    let mut hunks = parse_unified_diff(&diff);
                    // Mark all hunks as not new
                    for hunk in &mut hunks {
                        hunk.is_new_file = false;
                    }

                    Ok(hunks)
                }
                Err(_) => {
                    // The file does not exist in the parent commit, so it is a new file
                    let diff_lines: Vec<DiffLine> = lines
                        .iter()
                        .enumerate()
                        .map(|(i, line)| DiffLine {
                            kind: DiffLineKind::Add,
                            content: line.clone(),
                            old_lineno: None,
                            new_lineno: Some(i + 1),
                        })
                        .collect();

                    let hunk = DiffHunk {
                        header: format!("@@ -0,0 +1,{} @@", lines.len()),
                        old_start: 0,
                        old_lines: 0,
                        new_start: 1,
                        new_lines: lines.len(),
                        lines: diff_lines,
                        is_new_file: true,
                    };

                    Ok(vec![hunk])
                }
            }
        }
        Err(_) => {
            // The file does not exist in this commit; it may have been deleted
            // Check whether it exists in the parent commit
            let parent_show_output = Command::new("git")
                .arg("-C")
                .arg(&path)
                .arg("show")
                .arg(format!("{}^:./{}", sha, file_path))
                .output();

            match parent_show_output {
                Ok(output) => {
                    // The file exists in the parent but not in this commit, so it was deleted
                    let file_content = String::from_utf8_lossy(&output.stdout);
                    let lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

                    let diff_lines: Vec<DiffLine> = lines
                        .iter()
                        .enumerate()
                        .map(|(i, line)| DiffLine {
                            kind: DiffLineKind::Del,
                            content: line.clone(),
                            old_lineno: Some(i + 1),
                            new_lineno: None,
                        })
                        .collect();

                    let hunk = DiffHunk {
                        header: format!("@@ -1,{} +0,0 @@", lines.len()),
                        old_start: 1,
                        old_lines: lines.len(),
                        new_start: 0,
                        new_lines: 0,
                        lines: diff_lines,
                        is_new_file: false,
                    };

                    Ok(vec![hunk])
                }
                Err(_) => {
                    // The file does not exist in either commit
                    Ok(vec![])
                }
            }
        }
    }
}

pub fn get_commit_worktree_comparison_files(
    path: String,
    base_ref: String,
) -> Result<Vec<FileChange>, String> {
    let base_ref = base_ref.trim();

    if base_ref.is_empty() {
        return Err("Commit ref is required.".to_string());
    }

    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let base_object = repo
        .revparse_single(base_ref)
        .map_err(|e| format!("Could not resolve commit ref '{}': {}", base_ref, e))?;
    let base_commit = base_object
        .peel_to_commit()
        .map_err(|e| format!("Could not resolve '{}' to a commit: {}", base_ref, e))?;
    let base_tree = base_commit.tree().map_err(|e| e.to_string())?;
    let diff = repo
        .diff_tree_to_workdir_with_index(Some(&base_tree), None)
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

pub fn get_commit_worktree_comparison_file_diff(
    path: String,
    base_ref: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    let base_ref = base_ref.trim();

    if base_ref.is_empty() {
        return Err("Commit ref is required.".to_string());
    }

    let diff = run_git_diff(
        &path,
        &[
            format!("-U{}", context),
            base_ref.to_string(),
            "--".to_string(),
            file_path,
        ],
    )?;

    if diff.trim().is_empty() {
        return Ok(vec![]);
    }

    Ok(parse_unified_diff(&diff))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, write_file};

    #[test]
    fn returns_changed_files_between_commit_and_worktree() {
        let repo = init_repo();
        let sha = commit_file(repo.path(), "src/file.txt", "one\n", "initial");
        write_file(repo.path(), "src/file.txt", "one\ntwo\n");

        let changes =
            get_commit_worktree_comparison_files(repo.path().to_string_lossy().to_string(), sha)
                .expect("worktree comparison should succeed");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "src/file.txt");
        assert_eq!(changes[0].insertions, 1);
    }

    #[test]
    fn returns_file_diff_between_commit_and_worktree() {
        let repo = init_repo();
        let sha = commit_file(repo.path(), "src/file.txt", "one\n", "initial");
        write_file(repo.path(), "src/file.txt", "one\ntwo\n");

        let hunks = get_commit_worktree_comparison_file_diff(
            repo.path().to_string_lossy().to_string(),
            sha,
            "src/file.txt".to_string(),
            3,
        )
        .expect("worktree comparison diff should succeed");

        assert_eq!(hunks.len(), 1);
        assert!(hunks[0]
            .lines
            .iter()
            .any(|line| line.kind == DiffLineKind::Add && line.content == "two"));
    }

    #[test]
    fn rejects_blank_commit_ref_for_worktree_comparison() {
        let error = get_commit_worktree_comparison_files(
            "/does-not-need-to-exist".to_string(),
            " ".to_string(),
        )
        .expect_err("blank ref should fail");

        assert_eq!(error, "Commit ref is required.");
    }
}
