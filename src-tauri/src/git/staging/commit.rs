use crate::git::repository_state::ensure_repository_has_commits;
use std::process::Command;

#[tauri::command]
pub fn git_commit(path: String, message: String, amend: bool) -> Result<(), String> {
    if amend {
        ensure_repository_has_commits(&path, "git commit --amend")?;
    }

    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(&path).arg("commit");
    if amend {
        cmd.arg("--amend");
    }
    cmd.arg("-m").arg(&message);
    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "git commit failed (code: {:?}):\nstdout: {}\nstderr: {}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
