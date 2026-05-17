use super::parse_unified_diff;
use crate::git::repository_state::repository_has_commits;
use crate::git::types::*;
use std::collections::HashMap;
use std::process::Command;

fn get_index_file_diff_hunks(
    path: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    let has_commits = repository_has_commits(&path)?;

    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg("--cached")
        .arg(format!("-U{}", context))
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    let diff = String::from_utf8_lossy(&output.stdout);

    if diff.trim().is_empty() {
        return Ok(vec![]); // No changes
    }

    let mut hunks = parse_unified_diff(&diff);
    for hunk in &mut hunks {
        hunk.is_new_file = !has_commits || hunk.old_start == 0;
    }

    Ok(hunks)
}

pub fn get_index_diffs_for_files(
    path: String,
    file_paths: Vec<String>,
    context: usize,
) -> Result<HashMap<String, Vec<DiffHunk>>, String> {
    let mut result = HashMap::new();

    for file_path in file_paths {
        let hunks = get_index_file_diff_hunks(path.clone(), file_path.clone(), context)?;
        if !hunks.is_empty() {
            result.insert(file_path, hunks);
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{init_repo, run_git, write_file};

    #[test]
    fn returns_new_file_hunks_for_staged_files_before_first_commit() {
        let repo = init_repo();
        write_file(repo.path(), "file.txt", "hello\n");
        run_git(repo.path(), &["add", "file.txt"]);

        let diffs = get_index_diffs_for_files(
            repo.path().to_string_lossy().to_string(),
            vec!["file.txt".to_string()],
            3,
        )
        .expect("staged diff should load before first commit");

        let hunks = diffs
            .get("file.txt")
            .expect("file should have staged hunks");
        assert!(hunks[0].is_new_file);
    }
}
