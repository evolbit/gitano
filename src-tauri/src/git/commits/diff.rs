use crate::git::types::*;
use git2::{Oid, Repository};
use tauri::command;

#[command]
pub fn get_commit_diff(path: String, sha: String) -> Result<CommitDiff, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let oid = Oid::from_str(&sha).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    // Get the parent commit to create a diff. If there's no parent, it's the initial commit.
    let parent_commit = if commit.parent_count() > 0 {
        Some(commit.parent(0).map_err(|e| e.to_string())?)
    } else {
        None
    };
    let parent_tree = parent_commit.as_ref().map(|p| p.tree().unwrap());
    let commit_tree = commit.tree().map_err(|e| e.to_string())?;

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
        .map_err(|e| e.to_string())?;

    let mut changes = Vec::new();

    // We iterate through the deltas in the diff.
    for i in 0..diff.deltas().len() {
        let delta = diff.get_delta(i).unwrap(); // Safe inside this loop
        let status = delta.status();
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        // Create a patch for this delta to get line stats.
        // Patch may not be created for binary files.
        let patch_result = git2::Patch::from_diff(&diff, i);

        let (insertions, deletions) = if let Ok(Some(patch)) = patch_result {
            // `line_stats()` gives (context, additions, deletions)
            if let Ok(stats) = patch.line_stats() {
                (stats.1 as u32, stats.2 as u32)
            } else {
                (0, 0) // No line stats available or error
            }
        } else {
            (0, 0) // Error creating patch or binary file
        };

        changes.push(FileChange {
            path,
            status: status.into(),
            insertions,
            deletions,
        });
    }

    Ok(CommitDiff {
        commit_sha: sha.to_string(),
        changes,
    })
}
