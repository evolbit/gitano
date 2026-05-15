// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod git;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            git::open_local_repo,
            git::get_branches,
            git::get_remote_branches,
            git::get_tags,
            git::search_tag_commits,
            git::create_tag,
            git::get_remote_url,
            git::get_worktrees,
            git::git_create_worktree,
            git::git_remove_worktree,
            git::get_commits_list_paginated,
            git::get_commit_diff,
            git::amend_commit_message,
            git::get_current_branch,
            git::get_file_diff_hunks,
            git::get_diff_context,
            git::get_commit_file_diff,
            git::get_working_directory_changes,
            git::get_index_diffs_for_files,
            git::git_add_file,
            git::git_stage_all,
            git::git_unstage_file,
            git::git_unstage_all,
            git::git_has_staged_changes,
            git::git_discard_file_changes,
            git::git_stage_lines,
            git::trash_untracked_file,
            git::git_commit,
            git::git_fetch,
            git::git_pull,
            git::git_push,
            git::git_checkout_branch,
            git::git_branch_pull_fast_forward,
            git::git_branch_push,
            git::git_branch_set_upstream,
            git::git_stash_all,
            git::git_stash_selected,
            git::git_stash_pop,
            git::git_stash_apply,
            git::git_stash_apply_files,
            git::git_stash_drop,
            git::git_stash_list,
            git::git_stash_files,
            git::git_stash_edit_message,
            git::get_stash_file_diff,
            git::sync_repo_watchers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
