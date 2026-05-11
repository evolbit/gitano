use crate::git::diff::*;
use crate::git::types::*;
use git2::{IndexEntry, Repository, StatusOptions};
use std::collections::HashMap;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::async_runtime::spawn_blocking;

fn build_line_signature(line: &DiffLine) -> String {
    format!(
        "{}:{}:{}:{}",
        match line.kind {
            DiffLineKind::Add => "Add",
            DiffLineKind::Del => "Del",
            DiffLineKind::Context => "Context",
        },
        line.old_lineno.map(|value| value.to_string()).unwrap_or_default(),
        line.new_lineno.map(|value| value.to_string()).unwrap_or_default(),
        line.content
    )
}

fn build_staged_file_state(
    working_hunks: &[DiffHunk],
    staged_hunks: &[DiffHunk],
    file_status: &ChangeType,
) -> Option<StagedFileSelectionState> {
    if staged_hunks.is_empty() {
        return None;
    }

    let mut staged_keys = HashSet::new();

    for hunk in staged_hunks {
        for line in &hunk.lines {
            if matches!(line.kind, DiffLineKind::Add | DiffLineKind::Del) {
                staged_keys.insert(build_line_signature(line));
            }
        }
    }

    let mut hunks: HashMap<usize, Vec<usize>> = HashMap::new();
    let mut total_stageable = 0usize;
    let mut total_selected = 0usize;

    for (hunk_idx, hunk) in working_hunks.iter().enumerate() {
        let mut selected = Vec::new();

        for (line_idx, line) in hunk.lines.iter().enumerate() {
            if !matches!(line.kind, DiffLineKind::Add | DiffLineKind::Del) {
                continue;
            }

            total_stageable += 1;

            if staged_keys.contains(&build_line_signature(line)) {
                selected.push(line_idx);
                total_selected += 1;
            }
        }

        if !selected.is_empty() {
            hunks.insert(hunk_idx, selected);
        }
    }

    if total_selected == 0 {
        return None;
    }

    if total_stageable > 0 && total_selected == total_stageable {
        let is_new_file = matches!(file_status, ChangeType::Added);
        return Some(StagedFileSelectionState {
            is_new_file: if is_new_file { Some(true) } else { None },
            is_whole_file_staged: if is_new_file {
                None
            } else {
                Some(true)
            },
            hunks: HashMap::new(),
        });
    }

    Some(StagedFileSelectionState {
        is_new_file: None,
        is_whole_file_staged: None,
        hunks,
    })
}

#[tauri::command]
pub async fn get_working_directory_changes(
    path: String,
) -> Result<WorkingDirectoryChangesResponse, String> {
    spawn_blocking(move || {
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

            // Get the hunks for this file
            let hunks = match get_file_diff_hunks(path.clone(), file_path.clone(), 3) {
                Ok(h) => h,
                Err(_) => vec![],
            };

            let (insertions, deletions) = hunks.iter().fold((0u32, 0u32), |acc, hunk| {
                hunk.lines.iter().fold(acc, |(adds, dels), line| match line.kind {
                    DiffLineKind::Add => (adds + 1, dels),
                    DiffLineKind::Del => (adds, dels + 1),
                    DiffLineKind::Context => (adds, dels),
                })
            });

            changes.push(FileChangeWithHunks {
                path: file_path,
                status: change_type,
                insertions,
                deletions,
                hunks,
            });
        }

        let staged_diffs_by_file = if changes.is_empty() {
            HashMap::new()
        } else {
            get_index_diffs_for_files(
                path.clone(),
                changes.iter().map(|file| file.path.clone()).collect(),
                3,
            )?
        };

        let mut staged_state_by_file = HashMap::new();

        for file in &changes {
            let Some(staged_hunks) = staged_diffs_by_file.get(&file.path) else {
                continue;
            };

            if let Some(staged_state) =
                build_staged_file_state(&file.hunks, staged_hunks, &file.status)
            {
                staged_state_by_file.insert(file.path.clone(), staged_state);
            }
        }

        Ok(WorkingDirectoryChangesResponse {
            changes,
            staged_state_by_file,
        })
    })
    .await
    .map_err(|e| e.to_string())?
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

    if output.status.success() {
        return Ok(());
    }

    let full_path = Path::new(&path).join(&file_path);
    if !full_path.exists() {
        let remove_cached_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("rm")
            .arg("--cached")
            .arg("--ignore-unmatch")
            .arg("--quiet")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if remove_cached_output.status.success() {
            return Ok(());
        }

        let add_all_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("add")
            .arg("-A")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if add_all_output.status.success() {
            return Ok(());
        }

        let update_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("add")
            .arg("-u")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if update_output.status.success() {
            return Ok(());
        }

        return Err(format!(
            "git add failed: {}\ngit rm --cached failed: {}\ngit add -A failed: {}\ngit add -u failed: {}",
            String::from_utf8_lossy(&output.stderr),
            String::from_utf8_lossy(&remove_cached_output.stderr),
            String::from_utf8_lossy(&add_all_output.stderr),
            String::from_utf8_lossy(&update_output.stderr)
        ));
    }

    Err(format!(
        "git add failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_stage_all(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("add")
        .arg("-A")
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git add -A failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_unstage_file(path: String, file_path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--staged")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let reset_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("reset")
        .arg("HEAD")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if reset_output.status.success() {
        return Ok(());
    }

    let remove_cached_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("rm")
        .arg("--cached")
        .arg("--quiet")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if remove_cached_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git unstage failed:\nrestore: {}\nreset: {}\nrm --cached: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&reset_output.stderr),
        String::from_utf8_lossy(&remove_cached_output.stderr)
    ))
}

#[tauri::command]
pub fn git_unstage_all(path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--staged")
        .arg("--")
        .arg(".")
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let reset_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("reset")
        .arg("HEAD")
        .arg("--")
        .arg(".")
        .output()
        .map_err(|e| e.to_string())?;

    if reset_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git unstage all failed:\nrestore: {}\nreset: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&reset_output.stderr)
    ))
}

#[tauri::command]
pub fn git_has_staged_changes(path: String) -> Result<bool, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg("--cached")
        .arg("--quiet")
        .arg("--exit-code")
        .output()
        .map_err(|e| e.to_string())?;

    match output.status.code() {
        Some(0) => Ok(false),
        Some(1) => Ok(true),
        _ => Err(format!(
            "git diff --cached failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )),
    }
}

#[tauri::command]
pub fn git_discard_file_changes(path: String, file_path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let checkout_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("checkout")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if checkout_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git discard failed:\nrestore: {}\ncheckout: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&checkout_output.stderr)
    ))
}

#[tauri::command]
pub fn trash_untracked_file(path: String, file_path: String) -> Result<(), String> {
    let full_path = Path::new(&path).join(&file_path);

    if !full_path.exists() {
        return Ok(());
    }

    if full_path.is_dir() {
        fs::remove_dir_all(&full_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&full_path).map_err(|e| e.to_string())?;
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
        while head_line_idx < hunk.old_start.saturating_sub(1)
            && head_line_idx < head_lines.len()
        {
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
pub async fn git_push(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_fetch(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("fetch")
            .arg("--all")
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "git fetch failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_pull(path: String, strategy: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("git");
        cmd.arg("-C").arg(&path).arg("pull");

        match strategy.as_str() {
            "pull-ff-only" => {
                cmd.arg("--ff-only");
            }
            "pull-rebase" => {
                cmd.arg("--rebase");
            }
            "pull-ff-if-possible" => {}
            other => {
                return Err(format!("Unsupported pull strategy: {}", other));
            }
        }

        let output = cmd.output().map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "git pull failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
