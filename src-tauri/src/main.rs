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
            git::get_commits,
            git::get_commit_graph,
            git::get_remote_branches,
            git::get_formatted_commits,
            git::get_commits_list_paginated,
            git::get_commit_diff,
            git::amend_commit_message,
            git::get_current_branch,
            git::get_file_diff_hunks,
            git::get_diff_context,
            git::get_commit_file_diff,
            git::get_working_directory_changes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
