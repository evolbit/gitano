use crate::git::diff::*;
use crate::git::types::*;
use git2::{IndexEntry, Repository, StatusOptions};
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub fn get_working_directory_changes(path: String) -> Result<Vec<FileChangeWithHunks>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut changes = Vec::new();

    // Get the working directory status
    let mut opts = StatusOptions::new();
    opts.include_ignored(false)
        .include_untracked(true)
        .recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    for entry in statuses.iter() {
        let status = entry.status();
        let file_path = entry.path().unwrap_or("").to_string();

        if file_path.is_empty() {
            continue;
        }

        // Determine the change type based on the status
        let change_type = if status.is_wt_new() {
            ChangeType::Added
        } else if status.is_wt_deleted() {
            ChangeType::Deleted
        } else if status.is_wt_modified() {
            ChangeType::Modified
        } else if status.is_wt_renamed() {
            ChangeType::Renamed
        } else if status.is_wt_typechange() {
            ChangeType::TypeChanged
        } else if status.is_index_new() {
            ChangeType::Added
        } else if status.is_index_deleted() {
            ChangeType::Deleted
        } else if status.is_index_modified() {
            ChangeType::Modified
        } else if status.is_index_renamed() {
            ChangeType::Renamed
        } else if status.is_index_typechange() {
            ChangeType::TypeChanged
        } else {
            ChangeType::Modified // Default
        };

        // Calculate insertions and deletions using git diff --numstat
        let output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("diff")
            .arg("--numstat")
            .arg("--")
            .arg(&file_path)
            .output();

        let (insertions, deletions) = if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Find the line corresponding to the file
            let line = stdout.lines().find(|l| l.contains(&file_path));
            if let Some(line) = line {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    (
                        parts[0].parse::<u32>().unwrap_or(0),
                        parts[1].parse::<u32>().unwrap_or(0),
                    )
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        // Get the hunks for this file
        let hunks = match get_file_diff_hunks(path.clone(), file_path.clone(), 3) {
            Ok(h) => h,
            Err(_) => vec![],
        };

        changes.push(FileChangeWithHunks {
            path: file_path,
            status: change_type,
            insertions,
            deletions,
            hunks,
        });
    }

    Ok(changes)
}

#[tauri::command]
pub fn git_add_file(path: String, file_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("add")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "git add failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn git_stage_lines(
    path: String,
    file_path: String,
    hunks: serde_json::Value,
) -> Result<(), String> {
    // 1. Open the repo
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;

    // 2. Read the staged content (index) as the base for building the new staged state
    let index_content = if let Some(entry) = index.get_path(Path::new(&file_path), 0) {
        let blob = repo.find_blob(entry.id).map_err(|e| e.to_string())?;
        str::from_utf8(blob.content()).unwrap_or("").to_string()
    } else {
        // The file is not in the index, so start with empty content
        String::new()
    };

    // 3. Read the current working directory contents
    let full_path = Path::new(&path).join(&file_path);
    let working_content = if full_path.exists() {
        fs::read_to_string(&full_path).map_err(|e| e.to_string())?
    } else {
        String::new()
    };

    // 4. Get the diff between the index and the working directory
    let diff_hunks = get_index_working_diff(&repo, &file_path)?;

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
    let index_lines: Vec<&str> = index_content.lines().collect();
    let working_lines: Vec<&str> = working_content.lines().collect();

    let mut new_staged_lines = Vec::new();
    let mut index_line_idx = 0;
    let mut working_line_idx = 0;

    for (hunk_idx, hunk) in diff_hunks.iter().enumerate() {
        // Add context lines before the hunk when present
        while index_line_idx < hunk.old_start.saturating_sub(1)
            && index_line_idx < index_lines.len()
        {
            new_staged_lines.push(index_lines[index_line_idx].to_string());
            index_line_idx += 1;
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
                    // Context line: always include it from the index
                    if index_line_idx < index_lines.len() {
                        new_staged_lines.push(index_lines[index_line_idx].to_string());
                    }
                    index_line_idx += 1;
                    working_line_idx += 1;
                }
                DiffLineKind::Del => {
                    // Deleted line
                    if is_selected {
                        // If selected, omit it (do not include it in staged)
                        index_line_idx += 1;
                    } else {
                        // If not selected, keep it in staged
                        if index_line_idx < index_lines.len() {
                            new_staged_lines.push(index_lines[index_line_idx].to_string());
                        }
                        index_line_idx += 1;
                    }
                }
                DiffLineKind::Add => {
                    // Added line
                    if is_selected {
                        // If selected, include it in staged
                        if working_line_idx < working_lines.len() {
                            new_staged_lines.push(working_lines[working_line_idx].to_string());
                        }
                    }
                    // Always advance in the working directory
                    working_line_idx += 1;
                }
            }
        }
    }

    // Add the remaining lines from the index
    while index_line_idx < index_lines.len() {
        new_staged_lines.push(index_lines[index_line_idx].to_string());
        index_line_idx += 1;
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

#[tauri::command]
pub fn git_commit(path: String, message: String, amend: bool) -> Result<(), String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(&path).arg("commit");
    if amend {
        cmd.arg("--amend");
    }
    cmd.arg("-m").arg(&message);
    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "git commit failed (code: {:?}):\nstdout: {}\nstderr: {}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("push")
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "git push failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
