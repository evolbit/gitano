use std::fs;
use std::path::Path;
use std::process::Command;
use tempfile::TempDir;

pub fn run_git(repo_path: &Path, args: &[&str]) {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .expect("git command should run");

    assert!(
        output.status.success(),
        "git {:?} failed\nstdout: {}\nstderr: {}",
        args,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

pub fn init_repo() -> TempDir {
    let temp_dir = tempfile::tempdir().expect("temp git repo should be created");
    run_git(temp_dir.path(), &["init", "-b", "main"]);
    run_git(temp_dir.path(), &["config", "user.name", "Test User"]);
    run_git(
        temp_dir.path(),
        &["config", "user.email", "test@example.invalid"],
    );
    temp_dir
}

pub fn write_file(repo_path: &Path, file_path: &str, content: &str) {
    let full_path = repo_path.join(file_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).expect("parent directory should be created");
    }
    fs::write(full_path, content).expect("file should be written");
}

pub fn commit_file(repo_path: &Path, file_path: &str, content: &str, message: &str) -> String {
    write_file(repo_path, file_path, content);
    run_git(repo_path, &["add", file_path]);
    run_git(repo_path, &["commit", "-m", message]);

    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(["rev-parse", "HEAD"])
        .output()
        .expect("git rev-parse should run");

    assert!(output.status.success(), "git rev-parse HEAD should succeed");
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}
