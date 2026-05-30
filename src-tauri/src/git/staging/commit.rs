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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{init_repo, run_git, write_file};
    use std::path::Path;

    #[test]
    fn git_commit_preserves_multiline_message_body() {
        let repo = init_repo();
        write_file(repo.path(), "file.txt", "hello\n");
        run_git(repo.path(), &["add", "file.txt"]);

        git_commit(
            repo.path().to_string_lossy().to_string(),
            "Subject line\n\nBody line".to_string(),
            false,
        )
        .expect("commit should succeed");

        assert_eq!(head_message(repo.path()), "Subject line\n\nBody line");
    }

    fn head_message(repo_path: &Path) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .args(["log", "-1", "--pretty=%B"])
            .output()
            .expect("git log should run");

        assert!(output.status.success(), "git log should succeed");
        String::from_utf8_lossy(&output.stdout)
            .trim_end_matches('\n')
            .to_string()
    }
}
