use crate::git::diff::{get_file_diff_hunks, get_index_diffs_for_files};
use crate::git::types::*;
use git2::{Repository, StatusOptions};
use std::collections::{HashMap, HashSet};
use tauri::async_runtime::spawn_blocking;

fn build_line_signature(line: &DiffLine) -> String {
    format!(
        "{}:{}:{}:{}",
        match line.kind {
            DiffLineKind::Add => "Add",
            DiffLineKind::Del => "Del",
            DiffLineKind::Context => "Context",
        },
        line.old_lineno
            .map(|value| value.to_string())
            .unwrap_or_default(),
        line.new_lineno
            .map(|value| value.to_string())
            .unwrap_or_default(),
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
            is_whole_file_staged: if is_new_file { None } else { Some(true) },
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
                hunk.lines
                    .iter()
                    .fold(acc, |(adds, dels), line| match line.kind {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn diff_line(
        kind: DiffLineKind,
        content: &str,
        old_lineno: Option<usize>,
        new_lineno: Option<usize>,
    ) -> DiffLine {
        DiffLine {
            kind,
            content: content.to_string(),
            old_lineno,
            new_lineno,
        }
    }

    fn hunk(lines: Vec<DiffLine>) -> DiffHunk {
        DiffHunk {
            header: "@@ -1,2 +1,2 @@".to_string(),
            old_start: 1,
            old_lines: 2,
            new_start: 1,
            new_lines: 2,
            lines,
            is_new_file: false,
        }
    }

    mod build_staged_file_state {
        use super::*;

        #[test]
        fn returns_partial_hunk_selection_when_only_some_lines_are_staged() {
            let working_hunks = vec![hunk(vec![
                diff_line(DiffLineKind::Context, "same", Some(1), Some(1)),
                diff_line(DiffLineKind::Del, "old", Some(2), None),
                diff_line(DiffLineKind::Add, "new", None, Some(2)),
            ])];
            let staged_hunks = vec![hunk(vec![diff_line(
                DiffLineKind::Add,
                "new",
                None,
                Some(2),
            )])];

            let state =
                build_staged_file_state(&working_hunks, &staged_hunks, &ChangeType::Modified)
                    .expect("partial staged lines should produce state");

            assert_eq!(state.hunks.get(&0), Some(&vec![2]));
            assert_eq!(state.is_whole_file_staged, None);
        }

        #[test]
        fn returns_whole_file_marker_when_every_stageable_line_is_staged() {
            let working_hunks = vec![hunk(vec![
                diff_line(DiffLineKind::Del, "old", Some(1), None),
                diff_line(DiffLineKind::Add, "new", None, Some(1)),
            ])];
            let staged_hunks = vec![hunk(vec![
                diff_line(DiffLineKind::Del, "old", Some(1), None),
                diff_line(DiffLineKind::Add, "new", None, Some(1)),
            ])];

            let state =
                build_staged_file_state(&working_hunks, &staged_hunks, &ChangeType::Modified)
                    .expect("fully staged tracked file should produce state");

            assert_eq!(state.is_whole_file_staged, Some(true));
            assert!(state.hunks.is_empty());
        }

        #[test]
        fn returns_new_file_marker_when_every_added_line_is_staged() {
            let working_hunks = vec![hunk(vec![diff_line(
                DiffLineKind::Add,
                "new",
                None,
                Some(1),
            )])];
            let staged_hunks = vec![hunk(vec![diff_line(
                DiffLineKind::Add,
                "new",
                None,
                Some(1),
            )])];

            let state = build_staged_file_state(&working_hunks, &staged_hunks, &ChangeType::Added)
                .expect("fully staged new file should produce state");

            assert_eq!(state.is_new_file, Some(true));
            assert_eq!(state.is_whole_file_staged, None);
        }

        #[test]
        fn returns_none_when_staged_hunks_do_not_match_working_lines() {
            let working_hunks = vec![hunk(vec![diff_line(
                DiffLineKind::Add,
                "working",
                None,
                Some(1),
            )])];
            let staged_hunks = vec![hunk(vec![diff_line(
                DiffLineKind::Add,
                "different",
                None,
                Some(1),
            )])];

            let state = build_staged_file_state(&working_hunks, &staged_hunks, &ChangeType::Added);

            assert!(state.is_none());
        }
    }
}
