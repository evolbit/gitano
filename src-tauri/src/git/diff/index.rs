use super::parse_unified_diff;
use crate::git::types::*;
use std::collections::HashMap;
use std::process::Command;

fn get_index_file_diff_hunks(
    path: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
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
    // Mark all hunks as not new
    for hunk in &mut hunks {
        hunk.is_new_file = false;
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
