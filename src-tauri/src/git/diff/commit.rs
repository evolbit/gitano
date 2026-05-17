use super::parse_unified_diff;
use crate::git::types::*;
use std::process::Command;

pub fn get_commit_file_diff(
    path: String,
    sha: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    // Check whether the file exists in the commit
    let show_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("show")
        .arg(format!("{}:./{}", sha, file_path))
        .output();

    match show_output {
        Ok(output) => {
            let file_content = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

            // Check whether the file exists in the parent commit
            let parent_show_output = Command::new("git")
                .arg("-C")
                .arg(&path)
                .arg("show")
                .arg(format!("{}^:./{}", sha, file_path))
                .output();

            match parent_show_output {
                Ok(_) => {
                    // The file exists in both commits, get the regular diff
                    let diff_output = Command::new("git")
                        .arg("-C")
                        .arg(&path)
                        .arg("diff")
                        .arg(format!("-U{}", context))
                        .arg(format!("{}^", sha))
                        .arg(&sha)
                        .arg("--")
                        .arg(&file_path)
                        .output()
                        .map_err(|e| e.to_string())?;
                    let diff = String::from_utf8_lossy(&diff_output.stdout);

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
                Err(_) => {
                    // The file does not exist in the parent commit, so it is a new file
                    let diff_lines: Vec<DiffLine> = lines
                        .iter()
                        .enumerate()
                        .map(|(i, line)| DiffLine {
                            kind: DiffLineKind::Add,
                            content: line.clone(),
                            old_lineno: None,
                            new_lineno: Some(i + 1),
                        })
                        .collect();

                    let hunk = DiffHunk {
                        header: format!("@@ -0,0 +1,{} @@", lines.len()),
                        old_start: 0,
                        old_lines: 0,
                        new_start: 1,
                        new_lines: lines.len(),
                        lines: diff_lines,
                        is_new_file: true,
                    };

                    Ok(vec![hunk])
                }
            }
        }
        Err(_) => {
            // The file does not exist in this commit; it may have been deleted
            // Check whether it exists in the parent commit
            let parent_show_output = Command::new("git")
                .arg("-C")
                .arg(&path)
                .arg("show")
                .arg(format!("{}^:./{}", sha, file_path))
                .output();

            match parent_show_output {
                Ok(output) => {
                    // The file exists in the parent but not in this commit, so it was deleted
                    let file_content = String::from_utf8_lossy(&output.stdout);
                    let lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

                    let diff_lines: Vec<DiffLine> = lines
                        .iter()
                        .enumerate()
                        .map(|(i, line)| DiffLine {
                            kind: DiffLineKind::Del,
                            content: line.clone(),
                            old_lineno: Some(i + 1),
                            new_lineno: None,
                        })
                        .collect();

                    let hunk = DiffHunk {
                        header: format!("@@ -1,{} +0,0 @@", lines.len()),
                        old_start: 1,
                        old_lines: lines.len(),
                        new_start: 0,
                        new_lines: 0,
                        lines: diff_lines,
                        is_new_file: false,
                    };

                    Ok(vec![hunk])
                }
                Err(_) => {
                    // The file does not exist in either commit
                    Ok(vec![])
                }
            }
        }
    }
}
