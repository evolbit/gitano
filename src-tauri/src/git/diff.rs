use crate::git::types::*;
use git2::Repository;
use regex::Regex;
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
    // Check whether the file exists in the working directory
    let file_path_obj = Path::new(&file_path);
    let full_path = Path::new(&path).join(file_path_obj);

    if !full_path.exists() {
        return Ok(vec![]); // The file does not exist, so there is no diff
    }

    // Check whether the file is in the Git index
    let ls_files_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("ls-files")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    let is_tracked = !ls_files_output.stdout.is_empty();

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

    // Tracked file: get the regular diff
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
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

// Helper function to get the diff between the index and the working directory
pub fn get_index_working_diff(repo: &Repository, file_path: &str) -> Result<Vec<DiffHunk>, String> {
    let full_path = Path::new(repo.path().parent().unwrap()).join(file_path);

    // Check whether the file exists in the working directory
    if !full_path.exists() {
        return Ok(vec![]); // The file does not exist, so there is no diff
    }

    // Check whether the file is in the Git index
    let ls_files_output = Command::new("git")
        .arg("-C")
        .arg(repo.path().parent().unwrap())
        .arg("ls-files")
        .arg(file_path)
        .output()
        .map_err(|e| e.to_string())?;

    let is_tracked = !ls_files_output.stdout.is_empty();

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

    // Tracked file: get the regular diff between the index and the working directory
    let output = Command::new("git")
        .arg("-C")
        .arg(repo.path().parent().unwrap())
        .arg("diff")
        .arg("-U3")
        .arg("--")
        .arg(file_path)
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
