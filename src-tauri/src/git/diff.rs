use crate::git::types::*;
use git2::{ObjectType, Oid, Repository};
use regex::Regex;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;

pub fn parse_unified_diff(diff: &str) -> Vec<DiffHunk> {
    let hunk_re = Regex::new(r"^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@").unwrap();
    let mut hunks = Vec::new();
    let mut lines = diff.lines().peekable();

    while let Some(line) = lines.next() {
        if let Some(cap) = hunk_re.captures(line) {
            let old_start = cap[1].parse::<usize>().unwrap();
            let old_lines = cap.get(2).map_or(1, |m| m.as_str().parse().unwrap_or(1));
            let new_start = cap[3].parse::<usize>().unwrap();
            let new_lines = cap.get(4).map_or(1, |m| m.as_str().parse().unwrap_or(1));
            let mut hunk_lines = Vec::new();
            let mut old_lineno = old_start;
            let mut new_lineno = new_start;
            while let Some(&next_line) = lines.peek() {
                if next_line.starts_with("@@") {
                    break;
                }
                let (kind, content, old_num, new_num) = if next_line.starts_with('+') {
                    (DiffLineKind::Add, &next_line[1..], None, Some(new_lineno))
                } else if next_line.starts_with('-') {
                    (DiffLineKind::Del, &next_line[1..], Some(old_lineno), None)
                } else {
                    (
                        DiffLineKind::Context,
                        if next_line.starts_with(' ') {
                            &next_line[1..]
                        } else {
                            next_line
                        },
                        Some(old_lineno),
                        Some(new_lineno),
                    )
                };
                hunk_lines.push(DiffLine {
                    kind,
                    content: content.to_string(),
                    old_lineno: old_num,
                    new_lineno: new_num,
                });
                match kind {
                    DiffLineKind::Add => new_lineno += 1,
                    DiffLineKind::Del => old_lineno += 1,
                    DiffLineKind::Context => {
                        old_lineno += 1;
                        new_lineno += 1;
                    }
                }
                lines.next();
            }
            hunks.push(DiffHunk {
                header: line.to_string(),
                old_start,
                old_lines,
                new_start,
                new_lines,
                lines: hunk_lines,
                is_new_file: false,
            });
        }
    }
    hunks
}

pub fn get_file_diff_hunks(
    path: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    // Check whether the file is in the Git index
    let ls_files_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("ls-files")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    let is_tracked = !ls_files_output.stdout.is_empty();
    let file_path_obj = Path::new(&file_path);
    let full_path = Path::new(&path).join(file_path_obj);

    if !full_path.exists() {
        // A file may be missing from both working tree and index when its deletion
        // is already staged. In that case it still exists in HEAD and should be
        // rendered as a deletion hunk instead of an empty (0/0) change.
        let show_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("show")
            .arg(format!("HEAD:./{}", file_path))
            .output()
            .map_err(|e| e.to_string())?;

        if !show_output.status.success() {
            return Ok(vec![]);
        }

        let file_content = String::from_utf8_lossy(&show_output.stdout);
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

        return Ok(vec![hunk]);
    }

    // If the file is not tracked, it is a new file
    if !is_tracked {
        // Read the file contents
        let file_content = fs::read_to_string(&full_path).map_err(|e| e.to_string())?;
        let lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

        // Create a special hunk for a new file
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

        return Ok(vec![hunk]);
    }

    // Tracked file: get the full working diff against HEAD so staged selections
    // remain visible and reversible after refresh.
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg(format!("-U{}", context))
        .arg("HEAD")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;
    let diff = String::from_utf8_lossy(&output.stdout);

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

pub fn get_diff_context(
    path: String,
    file_path: String,
    hunk_index: usize,
    direction: ContextDirection,
    lines: usize,
    context: usize,
    offset: usize,
) -> Result<Vec<DiffLine>, String> {
    // 1. Get the current hunks
    let hunks = get_file_diff_hunks(path.clone(), file_path.clone(), context)?;
    if hunk_index >= hunks.len() {
        return Err("Hunk index out of range".to_string());
    }
    let hunk = &hunks[hunk_index];
    // 2. Read the original file
    use std::fs::File;
    use std::io::{BufRead, BufReader};
    let file = File::open(format!("{}/{}", path, file_path)).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(Result::ok).collect();
    let mut result = Vec::new();
    match direction {
        ContextDirection::Above => {
            let start = if hunk.old_start > lines + offset {
                hunk.old_start - lines - offset - 1
            } else {
                0
            };
            let end = if hunk.old_start > offset {
                hunk.old_start - offset - 1
            } else {
                0
            };
            for i in start..end {
                result.push(DiffLine {
                    kind: DiffLineKind::Context,
                    content: all_lines.get(i).cloned().unwrap_or_default(),
                    old_lineno: Some(i + 1),
                    new_lineno: Some(i + 1),
                });
            }
        }
        ContextDirection::Below => {
            let start = hunk.old_start + hunk.old_lines - 1 + offset;
            let end = std::cmp::min(start + lines, all_lines.len());
            for i in start..end {
                result.push(DiffLine {
                    kind: DiffLineKind::Context,
                    content: all_lines.get(i).cloned().unwrap_or_default(),
                    old_lineno: Some(i + 1),
                    new_lineno: Some(i + 1),
                });
            }
        }
    }
    Ok(result)
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

pub fn get_index_file_diff_hunks(
    path: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg("--cached")
        .arg(format!("-U{}", context))
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    let diff = String::from_utf8_lossy(&output.stdout);

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

pub fn get_index_diffs_for_files(
    path: String,
    file_paths: Vec<String>,
    context: usize,
) -> Result<HashMap<String, Vec<DiffHunk>>, String> {
    let mut result = HashMap::new();

    for file_path in file_paths {
        let hunks = get_index_file_diff_hunks(path.clone(), file_path.clone(), context)?;
        if !hunks.is_empty() {
            result.insert(file_path, hunks);
        }
    }

    Ok(result)
}

fn validate_ref_name<'a>(ref_name: &'a str, label: &str) -> Result<&'a str, String> {
    let ref_name = ref_name.trim();

    if ref_name.is_empty() {
        return Err(format!("{} branch is required.", label));
    }

    Ok(ref_name)
}

fn resolve_commit<'repo>(
    repo: &'repo Repository,
    ref_name: &str,
    label: &str,
) -> Result<git2::Commit<'repo>, String> {
    let object = repo
        .revparse_single(ref_name)
        .map_err(|e| format!("Could not resolve {} branch '{}': {}", label, ref_name, e))?;
    let commit_object = object.peel(ObjectType::Commit).map_err(|e| {
        format!(
            "Could not peel {} branch '{}' to a commit: {}",
            label, ref_name, e
        )
    })?;

    commit_object.into_commit().map_err(|_| {
        format!(
            "{} branch '{}' does not resolve to a commit.",
            label, ref_name
        )
    })
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BranchComparisonMode {
    Direct,
    MergeBase,
}

impl Default for BranchComparisonMode {
    fn default() -> Self {
        Self::MergeBase
    }
}

fn resolve_branch_comparison_refs(
    path: &str,
    base_ref: &str,
    head_ref: &str,
) -> Result<(Repository, Oid, Oid), String> {
    let base_ref = validate_ref_name(base_ref, "Base")?;
    let head_ref = validate_ref_name(head_ref, "Head")?;
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let base_commit = resolve_commit(&repo, base_ref, "base")?;
    let head_commit = resolve_commit(&repo, head_ref, "head")?;
    let base_oid = base_commit.id();
    let head_oid = head_commit.id();

    drop(base_commit);
    drop(head_commit);

    Ok((repo, base_oid, head_oid))
}

fn resolve_branch_comparison_from_oid(
    repo: &Repository,
    base_oid: Oid,
    head_oid: Oid,
    base_ref: &str,
    head_ref: &str,
    comparison_mode: Option<BranchComparisonMode>,
) -> Result<Oid, String> {
    match comparison_mode.unwrap_or_default() {
        BranchComparisonMode::Direct => Ok(base_oid),
        BranchComparisonMode::MergeBase => repo.merge_base(base_oid, head_oid).map_err(|e| {
            format!(
                "Could not find merge base for '{}' and '{}': {}",
                base_ref, head_ref, e
            )
        }),
    }
}

fn diff_delta_path(delta: &git2::DiffDelta<'_>) -> Option<String> {
    delta
        .new_file()
        .path()
        .or_else(|| delta.old_file().path())
        .and_then(|path| path.to_str())
        .map(ToString::to_string)
}

pub fn get_branch_comparison_files(
    path: String,
    base_ref: String,
    head_ref: String,
    comparison_mode: Option<BranchComparisonMode>,
) -> Result<Vec<FileChange>, String> {
    let (repo, base_oid, head_oid) = resolve_branch_comparison_refs(&path, &base_ref, &head_ref)?;
    let from_oid = resolve_branch_comparison_from_oid(
        &repo,
        base_oid,
        head_oid,
        &base_ref,
        &head_ref,
        comparison_mode,
    )?;
    let from_commit = repo.find_commit(from_oid).map_err(|e| e.to_string())?;
    let head_commit = repo.find_commit(head_oid).map_err(|e| e.to_string())?;
    let from_tree = from_commit.tree().map_err(|e| e.to_string())?;
    let head_tree = head_commit.tree().map_err(|e| e.to_string())?;
    let diff = repo
        .diff_tree_to_tree(Some(&from_tree), Some(&head_tree), None)
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

pub fn get_branch_comparison_file_diff(
    path: String,
    base_ref: String,
    head_ref: String,
    file_path: String,
    context: usize,
    comparison_mode: Option<BranchComparisonMode>,
) -> Result<Vec<DiffHunk>, String> {
    let (repo, base_oid, head_oid) = resolve_branch_comparison_refs(&path, &base_ref, &head_ref)?;
    let from_oid = resolve_branch_comparison_from_oid(
        &repo,
        base_oid,
        head_oid,
        &base_ref,
        &head_ref,
        comparison_mode,
    )?;
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg(format!("-U{}", context))
        .arg(from_oid.to_string())
        .arg(head_oid.to_string())
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "git diff failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let diff = String::from_utf8_lossy(&output.stdout);

    if diff.trim().is_empty() {
        return Ok(vec![]);
    }

    Ok(parse_unified_diff(&diff))
}
