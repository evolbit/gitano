// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod git;

use std::time::Duration;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|_app| {
            std::thread::spawn(|| loop {
                tauri::async_runtime::block_on(ai::warm_configured_models_background());
                std::thread::sleep(Duration::from_secs(20 * 60));
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            git::open_local_repo,
            git::get_repository_state,
            git::init_local_repo,
            git::get_branches,
            git::get_remote_branches,
            git::get_tags,
            git::get_tag_refs,
            git::get_local_tag_refs,
            git::get_origin_tag_refs,
            git::check_tag_name_availability,
            git::search_tag_commits,
            git::create_tag,
            git::push_tag,
            git::rename_tag,
            git::delete_tag,
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
            git::get_commit_worktree_comparison_files,
            git::get_commit_worktree_comparison_file_diff,
            git::get_branch_comparison_files,
            git::get_branch_comparison_file_diff,
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
            git::git_create_branch,
            git::git_branch_fast_forward_to_branch,
            git::git_branch_merge_into,
            git::git_branch_rebase_onto,
            git::git_rename_branch,
            git::git_delete_branch,
            git::git_branch_tip_sha,
            git::git_branch_pull_fast_forward,
            git::git_branch_push,
            git::git_branch_set_upstream,
            git::git_commit_patch,
            git::git_cherry_pick_commit,
            git::git_revert_commit,
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
            ai::ai_get_entitlement_status,
            ai::ai_get_model_catalog,
            ai::ai_get_external_agent_catalog,
            ai::ai_get_external_agent_status,
            ai::ai_get_external_agent_session_config,
            ai::ai_get_model_preferences,
            ai::ai_set_model_preference,
            ai::ai_set_analysis_engine_preference,
            ai::ai_set_external_agent_as_default,
            ai::ai_set_external_agent_config_preference,
            ai::ai_set_action_prompt_override,
            ai::ai_install_external_agent,
            ai::ai_remove_external_agent,
            ai::ai_authenticate_external_agent,
            ai::ai_logout_external_agent,
            ai::ai_run_external_agent_prompt,
            ai::ai_cancel_external_agent_run,
            ai::ai_set_model_warm_preference,
            ai::ai_get_machine_profile,
            ai::ai_get_model_status,
            ai::ai_get_runtime_status,
            ai::ai_get_model_compatibility,
            ai::ai_prepare_runtime,
            ai::ai_prepare_model,
            ai::ai_delete_model,
            ai::ai_warm_configured_models,
            ai::ai_run_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
