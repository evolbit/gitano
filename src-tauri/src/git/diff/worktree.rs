use super::parse_unified_diff;
use crate::git::types::*;
use std::fs;
use std::path::Path;
use std::process::Command;

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
