use crate::git::diff::get_file_diff_hunks;
use crate::git::types::DiffLineKind;
use git2::{IndexEntry, Repository};
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub fn git_stage_lines(
    path: String,
    file_path: String,
    hunks: serde_json::Value,
) -> Result<(), String> {
    // 1. Open the repo
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;

    // 2. Read the HEAD content as the stable baseline for rebuilding the desired
    // staged state from the full working diff selection.
    let head_content = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("show")
        .arg(format!("HEAD:./{}", file_path))
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).to_string())
        .unwrap_or_default();

    // 3. Read the current working directory contents
    let full_path = Path::new(&path).join(&file_path);
    let working_content = if full_path.exists() {
        fs::read_to_string(&full_path).map_err(|e| e.to_string())?
    } else {
        String::new()
    };

    // 4. Get the full diff between HEAD and the working directory
    let diff_hunks = get_file_diff_hunks(path.clone(), file_path.clone(), 3)?;

    // 5. Parse the selected lines (hunks: { hunkIdx: [lineIdx, ...], ... })
    let mut selected_lines = std::collections::HashMap::new();
    if let Some(obj) = hunks.as_object() {
        for (hunk_idx_str, arr) in obj.iter() {
            if let Some(hunk_idx) = hunk_idx_str.parse::<usize>().ok() {
                if let Some(arr) = arr.as_array() {
                    let mut line_indices = std::collections::HashSet::new();
                    for idx in arr {
                        if let Some(line_idx) = idx.as_u64() {
                            line_indices.insert(line_idx as usize);
                        }
                    }
                    if !line_indices.is_empty() {
                        selected_lines.insert(hunk_idx, line_indices);
                    }
                }
            }
        }
    }

    // 6. Build the new staged content by applying the partial diff
    let head_lines: Vec<&str> = head_content.lines().collect();
    let working_lines: Vec<&str> = working_content.lines().collect();

    let mut new_staged_lines = Vec::new();
    let mut head_line_idx = 0;
    let mut working_line_idx = 0;

    for (hunk_idx, hunk) in diff_hunks.iter().enumerate() {
        // Add context lines before the hunk when present
        while head_line_idx < hunk.old_start.saturating_sub(1) && head_line_idx < head_lines.len() {
            new_staged_lines.push(head_lines[head_line_idx].to_string());
            head_line_idx += 1;
            working_line_idx += 1;
        }

        // Process the hunk lines
        for (line_idx, line) in hunk.lines.iter().enumerate() {
            let is_selected = selected_lines
                .get(&hunk_idx)
                .map(|set| set.contains(&line_idx))
                .unwrap_or(false);

            match line.kind {
                DiffLineKind::Context => {
                    if head_line_idx < head_lines.len() {
                        new_staged_lines.push(head_lines[head_line_idx].to_string());
                    }
                    head_line_idx += 1;
                    working_line_idx += 1;
                }
                DiffLineKind::Del => {
                    if is_selected {
                        head_line_idx += 1;
                    } else {
                        if head_line_idx < head_lines.len() {
                            new_staged_lines.push(head_lines[head_line_idx].to_string());
                        }
                        head_line_idx += 1;
                    }
                }
                DiffLineKind::Add => {
                    if is_selected {
                        if working_line_idx < working_lines.len() {
                            new_staged_lines.push(working_lines[working_line_idx].to_string());
                        }
                    }
                    working_line_idx += 1;
                }
            }
        }
    }

    while head_line_idx < head_lines.len() {
        new_staged_lines.push(head_lines[head_line_idx].to_string());
        head_line_idx += 1;
    }

    // 7. Build the final content
    let new_content = if new_staged_lines.is_empty() {
        String::new()
    } else {
        new_staged_lines.join("\n") + "\n"
    };

    // 8. Write the new content to the index
    let oid = repo
        .blob(new_content.as_bytes())
        .map_err(|e| e.to_string())?;

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    let entry = IndexEntry {
        ctime: git2::IndexTime::new(now.as_secs() as i32, now.subsec_nanos() as u32),
        mtime: git2::IndexTime::new(now.as_secs() as i32, now.subsec_nanos() as u32),
        dev: 0,
        ino: 0,
        mode: 0o100644,
        uid: 0,
        gid: 0,
        file_size: new_content.len() as u32,
        id: oid,
        flags: 0,
        flags_extended: 0,
        path: file_path.as_bytes().to_vec(),
    };

    index.add(&entry).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    Ok(())
}
