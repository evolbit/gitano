use super::helpers::{run_git, run_git_status};
use std::io::Write;
use std::process::{Command, Stdio};

#[tauri::command]
pub fn git_stash_apply_files(
    path: String,
    stash_ref: String,
    file_paths: Vec<String>,
) -> Result<(), String> {
    if file_paths.is_empty() {
        return Err("No stash files selected for apply.".to_string());
    }

    let mut show_cmd = Command::new("git");
    show_cmd
        .arg("-C")
        .arg(&path)
        .arg("stash")
        .arg("show")
        .arg("-p")
        .arg("--include-untracked")
        .arg(&stash_ref)
        .arg("--");

    for file_path in &file_paths {
        show_cmd.arg(file_path);
    }

    let show_output = show_cmd.output().map_err(|e| e.to_string())?;
    if !show_output.status.success() {
        return Err(format!(
            "git stash show failed: {}",
            String::from_utf8_lossy(&show_output.stderr)
        ));
    }

    if show_output.stdout.is_empty() {
        return Ok(());
    }

    let mut apply_cmd = Command::new("git");
    apply_cmd
        .arg("-C")
        .arg(&path)
        .arg("apply")
        .arg("--whitespace=nowarn")
        .arg("--recount")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = apply_cmd.spawn().map_err(|e| e.to_string())?;
    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(&show_output.stdout)
            .map_err(|e| e.to_string())?;
    }

    let apply_output = child.wait_with_output().map_err(|e| e.to_string())?;
    if apply_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git apply selected stash files failed: {}",
        String::from_utf8_lossy(&apply_output.stderr)
    ))
}

#[tauri::command]
pub fn git_stash_edit_message(
    path: String,
    stash_ref: String,
    new_message: String,
) -> Result<(), String> {
    let trimmed = new_message.trim();
    if trimmed.is_empty() {
        return Err("Stash message cannot be empty.".to_string());
    }

    let old_hash = run_git(&path, &["rev-parse", &stash_ref])?
        .trim()
        .to_string();
    run_git_status(&path, &["stash", "drop", &stash_ref])?;
    run_git_status(&path, &["stash", "store", "-m", trimmed, &old_hash])?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_file_selections_before_reading_the_stash() {
        let result =
            git_stash_apply_files("/repo".to_string(), "stash@{0}".to_string(), Vec::new());

        assert_eq!(
            result,
            Err("No stash files selected for apply.".to_string())
        );
    }

    #[test]
    fn rejects_empty_replacement_messages_before_running_git() {
        let result = git_stash_edit_message(
            "/repo".to_string(),
            "stash@{0}".to_string(),
            " ".to_string(),
        );

        assert_eq!(result, Err("Stash message cannot be empty.".to_string()));
    }
}
