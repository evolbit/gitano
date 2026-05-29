use std::fs;
use std::path::Path;
use std::process::Command;

#[tauri::command]
pub fn git_add_file(path: String, file_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("add")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    let full_path = Path::new(&path).join(&file_path);
    if !full_path.exists() {
        let remove_cached_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("rm")
            .arg("--cached")
            .arg("--ignore-unmatch")
            .arg("--quiet")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if remove_cached_output.status.success() {
            return Ok(());
        }

        let add_all_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("add")
            .arg("-A")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if add_all_output.status.success() {
            return Ok(());
        }

        let update_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("add")
            .arg("-u")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if update_output.status.success() {
            return Ok(());
        }

        return Err(format!(
            "git add failed: {}\ngit rm --cached failed: {}\ngit add -A failed: {}\ngit add -u failed: {}",
            String::from_utf8_lossy(&output.stderr),
            String::from_utf8_lossy(&remove_cached_output.stderr),
            String::from_utf8_lossy(&add_all_output.stderr),
            String::from_utf8_lossy(&update_output.stderr)
        ));
    }

    Err(format!(
        "git add failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_stage_all(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("add")
        .arg("-A")
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git add -A failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_stage_paths(path: String, file_paths: Vec<String>) -> Result<(), String> {
    if file_paths.is_empty() {
        return Ok(());
    }

    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("add")
        .arg("-A")
        .arg("--")
        .args(&file_paths)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git add paths failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_unstage_file(path: String, file_path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--staged")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let reset_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("reset")
        .arg("HEAD")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if reset_output.status.success() {
        return Ok(());
    }

    let remove_cached_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("rm")
        .arg("--cached")
        .arg("--quiet")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if remove_cached_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git unstage failed:\nrestore: {}\nreset: {}\nrm --cached: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&reset_output.stderr),
        String::from_utf8_lossy(&remove_cached_output.stderr)
    ))
}

#[tauri::command]
pub fn git_unstage_paths(path: String, file_paths: Vec<String>) -> Result<(), String> {
    if file_paths.is_empty() {
        return Ok(());
    }

    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--staged")
        .arg("--")
        .args(&file_paths)
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let reset_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("reset")
        .arg("HEAD")
        .arg("--")
        .args(&file_paths)
        .output()
        .map_err(|e| e.to_string())?;

    if reset_output.status.success() {
        return Ok(());
    }

    let remove_cached_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("rm")
        .arg("--cached")
        .arg("-r")
        .arg("--quiet")
        .arg("--")
        .args(&file_paths)
        .output()
        .map_err(|e| e.to_string())?;

    if remove_cached_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git unstage paths failed:\nrestore: {}\nreset: {}\nrm --cached: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&reset_output.stderr),
        String::from_utf8_lossy(&remove_cached_output.stderr)
    ))
}

#[tauri::command]
pub fn git_unstage_all(path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--staged")
        .arg("--")
        .arg(".")
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let reset_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("reset")
        .arg("HEAD")
        .arg("--")
        .arg(".")
        .output()
        .map_err(|e| e.to_string())?;

    if reset_output.status.success() {
        return Ok(());
    }

    let remove_cached_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("rm")
        .arg("--cached")
        .arg("-r")
        .arg("--quiet")
        .arg("--")
        .arg(".")
        .output()
        .map_err(|e| e.to_string())?;

    if remove_cached_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git unstage all failed:\nrestore: {}\nreset: {}\nrm --cached: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&reset_output.stderr),
        String::from_utf8_lossy(&remove_cached_output.stderr)
    ))
}

#[tauri::command]
pub fn git_has_staged_changes(path: String) -> Result<bool, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg("--cached")
        .arg("--quiet")
        .arg("--exit-code")
        .output()
        .map_err(|e| e.to_string())?;

    match output.status.code() {
        Some(0) => Ok(false),
        Some(1) => Ok(true),
        _ => Err(format!(
            "git diff --cached failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )),
    }
}

#[tauri::command]
pub fn git_discard_file_changes(path: String, file_path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let checkout_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("checkout")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if checkout_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git discard failed:\nrestore: {}\ncheckout: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&checkout_output.stderr)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{init_repo, run_git, write_file};

    #[test]
    fn unstages_all_files_before_first_commit() {
        let repo = init_repo();
        write_file(repo.path(), "file.txt", "hello\n");
        run_git(repo.path(), &["add", "file.txt"]);

        git_unstage_all(repo.path().to_string_lossy().to_string())
            .expect("unstage all should work before first commit");

        let has_staged = git_has_staged_changes(repo.path().to_string_lossy().to_string())
            .expect("staged check should work before first commit");
        assert!(!has_staged);
    }

    #[test]
    fn stages_multiple_paths_in_one_command() {
        let repo = init_repo();
        write_file(repo.path(), "a.txt", "a\n");
        write_file(repo.path(), "b.txt", "b\n");

        git_stage_paths(
            repo.path().to_string_lossy().to_string(),
            vec!["a.txt".to_string(), "b.txt".to_string()],
        )
        .expect("stage paths should work");

        let status_output = Command::new("git")
            .arg("-C")
            .arg(repo.path())
            .args(["diff", "--cached", "--name-only"])
            .output()
            .expect("git diff --cached should run");
        assert!(status_output.status.success());

        let status = String::from_utf8_lossy(&status_output.stdout);
        assert!(status.contains("a.txt"));
        assert!(status.contains("b.txt"));
    }

    #[test]
    fn unstages_multiple_paths_in_one_command() {
        let repo = init_repo();
        write_file(repo.path(), "a.txt", "a\n");
        write_file(repo.path(), "b.txt", "b\n");
        run_git(repo.path(), &["add", "a.txt", "b.txt"]);

        git_unstage_paths(
            repo.path().to_string_lossy().to_string(),
            vec!["a.txt".to_string(), "b.txt".to_string()],
        )
        .expect("unstage paths should work");

        let has_staged = git_has_staged_changes(repo.path().to_string_lossy().to_string())
            .expect("staged check should work");
        assert!(!has_staged);
    }

    #[test]
    fn stage_paths_reports_git_failures() {
        let repo = init_repo();
        let missing_repo_path = repo.path().join("missing");

        let err = git_stage_paths(
            missing_repo_path.to_string_lossy().to_string(),
            vec!["a.txt".to_string()],
        )
        .expect_err("invalid repository should fail");

        assert!(err.contains("git add paths failed"));
    }

    #[test]
    fn unstage_paths_reports_git_failures() {
        let repo = init_repo();
        let missing_repo_path = repo.path().join("missing");

        let err = git_unstage_paths(
            missing_repo_path.to_string_lossy().to_string(),
            vec!["a.txt".to_string()],
        )
        .expect_err("invalid repository should fail");

        assert!(err.contains("git unstage paths failed"));
    }
}

#[tauri::command]
pub fn trash_untracked_file(path: String, file_path: String) -> Result<(), String> {
    let full_path = Path::new(&path).join(&file_path);

    if !full_path.exists() {
        return Ok(());
    }

    if full_path.is_dir() {
        fs::remove_dir_all(&full_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&full_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}
