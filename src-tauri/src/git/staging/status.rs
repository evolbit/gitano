use crate::git::diff::{get_file_diff_hunks, get_index_diffs_for_files};
use crate::git::repository_state::repository_has_commits;
use crate::git::types::*;
use git2::{Repository, Status, StatusOptions};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::UNIX_EPOCH;
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
            is_partially_staged: None,
            hunks: HashMap::new(),
        });
    }

    Some(StagedFileSelectionState {
        is_new_file: None,
        is_whole_file_staged: None,
        is_partially_staged: Some(true),
        hunks,
    })
}

fn change_type_from_status(status: Status) -> ChangeType {
    if status.contains(Status::CONFLICTED) {
        ChangeType::Conflicted
    } else if status.is_wt_new() {
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
        ChangeType::Modified
    }
}

fn has_worktree_change(status: Status) -> bool {
    status.is_wt_new()
        || status.is_wt_deleted()
        || status.is_wt_modified()
        || status.is_wt_renamed()
        || status.is_wt_typechange()
}

fn has_index_change(status: Status) -> bool {
    status.is_index_new()
        || status.is_index_deleted()
        || status.is_index_modified()
        || status.is_index_renamed()
        || status.is_index_typechange()
}

fn is_untracked_status(status: Status) -> bool {
    status.is_wt_new() && !has_index_change(status)
}

fn count_file_lines(repo_path: &str, file_path: &str) -> u32 {
    let full_path = Path::new(repo_path).join(file_path);
    fs::read_to_string(full_path)
        .map(|content| content.lines().count() as u32)
        .unwrap_or(0)
}

fn parse_numstat_count(value: &str) -> u32 {
    value.parse::<u32>().unwrap_or(0)
}

fn load_numstat_counts(
    repo_path: &str,
    args: &[&str],
) -> Result<HashMap<String, (u32, u32)>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(HashMap::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut counts = HashMap::new();

    for line in stdout.lines() {
        let mut parts = line.split('\t');
        let insertions = parts.next().map(parse_numstat_count).unwrap_or(0);
        let deletions = parts.next().map(parse_numstat_count).unwrap_or(0);
        let Some(path) = parts.next() else {
            continue;
        };
        let final_path = parts.next().unwrap_or(path);
        counts.insert(final_path.to_string(), (insertions, deletions));
    }

    Ok(counts)
}

fn load_name_set(repo_path: &str, args: &[&str]) -> Result<HashSet<String>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(HashSet::new());
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect())
}

fn load_index_signatures(repo_path: &str) -> Result<HashMap<String, String>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(["ls-files", "-s", "-z", "--", "."])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(HashMap::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut signatures = HashMap::new();

    for record in stdout.split('\0').filter(|record| !record.is_empty()) {
        let Some((metadata, path)) = record.split_once('\t') else {
            continue;
        };
        let mut metadata_parts = metadata.split_whitespace();
        let mode = metadata_parts.next().unwrap_or_default();
        let object_id = metadata_parts.next().unwrap_or_default();
        let stage = metadata_parts.next().unwrap_or_default();

        signatures.insert(path.to_string(), format!("{mode}:{object_id}:{stage}"));
    }

    Ok(signatures)
}

fn build_worktree_metadata_signature(repo_path: &str, file_path: &str) -> String {
    let full_path = Path::new(repo_path).join(file_path);
    let Ok(metadata) = fs::symlink_metadata(full_path) else {
        return "missing".to_string();
    };
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    format!("len={}:mtime={modified}", metadata.len())
}

fn build_file_signature(
    repo_path: &str,
    file_path: &str,
    status: &ChangeType,
    insertions: u32,
    deletions: u32,
    index_signatures: &HashMap<String, String>,
) -> String {
    let worktree_signature = build_worktree_metadata_signature(repo_path, file_path);
    let index_signature = index_signatures
        .get(file_path)
        .map(String::as_str)
        .unwrap_or("not-indexed");

    format!(
        "{file_path}:{status:?}:{insertions}:{deletions}:{worktree_signature}:{index_signature}"
    )
}

fn build_summary_staged_state(
    file_status: &ChangeType,
    raw_status: Status,
    staged_names: &HashSet<String>,
    staged_counts: &HashMap<String, (u32, u32)>,
    total_counts: &HashMap<String, (u32, u32)>,
    file_path: &str,
) -> Option<StagedFileSelectionState> {
    if !staged_names.contains(file_path) {
        return None;
    }

    let staged_total = staged_counts
        .get(file_path)
        .map(|(insertions, deletions)| insertions + deletions)
        .unwrap_or(0);
    let total = total_counts
        .get(file_path)
        .map(|(insertions, deletions)| insertions + deletions)
        .unwrap_or(staged_total);
    let index_changed = has_index_change(raw_status);
    let worktree_changed = has_worktree_change(raw_status);
    let whole_file_staged =
        index_changed && (!worktree_changed || (total > 0 && staged_total == total));
    let is_new_file = matches!(file_status, ChangeType::Added) && whole_file_staged;

    if whole_file_staged {
        return Some(StagedFileSelectionState {
            is_new_file: if is_new_file { Some(true) } else { None },
            is_whole_file_staged: if is_new_file { None } else { Some(true) },
            is_partially_staged: None,
            hunks: HashMap::new(),
        });
    }

    Some(StagedFileSelectionState {
        is_new_file: None,
        is_whole_file_staged: None,
        is_partially_staged: Some(true),
        hunks: HashMap::new(),
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

            let change_type = change_type_from_status(status);

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

#[tauri::command]
pub async fn get_working_directory_summary(
    path: String,
) -> Result<WorkingDirectorySummaryResponse, String> {
    spawn_blocking(move || {
        let repo = Repository::open(&path).map_err(|e| e.to_string())?;
        let has_commits = repository_has_commits(&path)?;
        let mut opts = StatusOptions::new();
        opts.include_ignored(false)
            .include_untracked(true)
            .recurse_untracked_dirs(true);
        let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

        let total_counts = if has_commits {
            load_numstat_counts(&path, &["diff", "--numstat", "HEAD", "--", "."])?
        } else {
            HashMap::new()
        };
        let staged_counts =
            load_numstat_counts(&path, &["diff", "--cached", "--numstat", "--", "."])?;
        let staged_names = load_name_set(&path, &["diff", "--cached", "--name-only", "--", "."])?;
        let index_signatures = load_index_signatures(&path)?;

        let mut changes = Vec::new();
        let mut staged_state_by_file = HashMap::new();

        for entry in statuses.iter() {
            let raw_status = entry.status();
            let file_path = entry.path().unwrap_or("").to_string();

            if file_path.is_empty() {
                continue;
            }

            let change_type = change_type_from_status(raw_status);
            let is_untracked = is_untracked_status(raw_status);
            let fallback_insertions = if !has_commits || is_untracked {
                count_file_lines(&path, &file_path)
            } else {
                0
            };
            let (insertions, deletions) = total_counts
                .get(&file_path)
                .copied()
                .unwrap_or((fallback_insertions, 0));
            let staged_state = build_summary_staged_state(
                &change_type,
                raw_status,
                &staged_names,
                &staged_counts,
                &total_counts,
                &file_path,
            );
            let file_signature = build_file_signature(
                &path,
                &file_path,
                &change_type,
                insertions,
                deletions,
                &index_signatures,
            );

            if let Some(staged_state) = staged_state {
                staged_state_by_file.insert(file_path.clone(), staged_state);
            }

            changes.push(WorkingChangeFileSummary {
                path: file_path,
                status: change_type,
                insertions,
                deletions,
                is_untracked,
                file_signature,
            });
        }

        Ok(WorkingDirectorySummaryResponse {
            changes,
            staged_state_by_file,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_working_file_detail(
    path: String,
    file_path: String,
) -> Result<WorkingFileDetailResponse, String> {
    spawn_blocking(move || {
        let repo = Repository::open(&path).map_err(|e| e.to_string())?;
        let raw_status = repo
            .status_file(Path::new(&file_path))
            .map_err(|e| e.to_string())?;
        let change_type = change_type_from_status(raw_status);
        let hunks = get_file_diff_hunks(path.clone(), file_path.clone(), 3)?;
        let (insertions, deletions) = hunks.iter().fold((0u32, 0u32), |acc, hunk| {
            hunk.lines
                .iter()
                .fold(acc, |(adds, dels), line| match line.kind {
                    DiffLineKind::Add => (adds + 1, dels),
                    DiffLineKind::Del => (adds, dels + 1),
                    DiffLineKind::Context => (adds, dels),
                })
        });
        let staged_diffs_by_file =
            get_index_diffs_for_files(path.clone(), vec![file_path.clone()], 3)?;
        let staged_state = staged_diffs_by_file
            .get(&file_path)
            .and_then(|staged_hunks| build_staged_file_state(&hunks, staged_hunks, &change_type));
        let index_signatures = load_index_signatures(&path)?;
        let file_signature = build_file_signature(
            &path,
            &file_path,
            &change_type,
            insertions,
            deletions,
            &index_signatures,
        );

        Ok(WorkingFileDetailResponse {
            file: FileChangeWithHunks {
                path: file_path,
                status: change_type,
                insertions,
                deletions,
                hunks,
            },
            staged_state,
            file_signature,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{init_repo, run_git, write_file};

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

    mod summary_and_detail {
        use super::*;

        #[test]
        fn summary_returns_changed_file_without_full_hunks() {
            let repo = init_repo();
            write_file(repo.path(), "file.txt", "hello\n");

            let summary = tauri::async_runtime::block_on(get_working_directory_summary(
                repo.path().to_string_lossy().to_string(),
            ))
            .expect("summary should load");

            assert_eq!(summary.changes.len(), 1);
            assert_eq!(summary.changes[0].path, "file.txt");
            assert!(summary.changes[0].is_untracked);
            assert_eq!(summary.changes[0].insertions, 1);
            assert!(summary.staged_state_by_file.is_empty());
        }

        #[test]
        fn detail_returns_hunks_for_one_file() {
            let repo = init_repo();
            write_file(repo.path(), "file.txt", "hello\n");

            let detail = tauri::async_runtime::block_on(get_working_file_detail(
                repo.path().to_string_lossy().to_string(),
                "file.txt".to_string(),
            ))
            .expect("detail should load");

            assert_eq!(detail.file.path, "file.txt");
            assert_eq!(detail.file.hunks.len(), 1);
            assert_eq!(detail.file.insertions, 1);
        }

        #[test]
        fn summary_reports_whole_file_staged_state() {
            let repo = init_repo();
            write_file(repo.path(), "file.txt", "hello\n");
            run_git(repo.path(), &["add", "file.txt"]);

            let summary = tauri::async_runtime::block_on(get_working_directory_summary(
                repo.path().to_string_lossy().to_string(),
            ))
            .expect("summary should load");

            let staged_state = summary
                .staged_state_by_file
                .get("file.txt")
                .expect("staged new file should have state");
            assert_eq!(staged_state.is_new_file, Some(true));
            assert_eq!(staged_state.is_whole_file_staged, None);
            assert_eq!(staged_state.is_partially_staged, None);
        }

        #[test]
        fn summary_signature_changes_when_file_content_metadata_changes() {
            let repo = init_repo();
            write_file(repo.path(), "file.txt", "one\n");

            let first_summary = tauri::async_runtime::block_on(get_working_directory_summary(
                repo.path().to_string_lossy().to_string(),
            ))
            .expect("first summary should load");

            write_file(repo.path(), "file.txt", "three\n");

            let next_summary = tauri::async_runtime::block_on(get_working_directory_summary(
                repo.path().to_string_lossy().to_string(),
            ))
            .expect("next summary should load");

            assert_eq!(first_summary.changes[0].insertions, 1);
            assert_eq!(next_summary.changes[0].insertions, 1);
            assert_ne!(
                first_summary.changes[0].file_signature,
                next_summary.changes[0].file_signature
            );
        }
    }
}
