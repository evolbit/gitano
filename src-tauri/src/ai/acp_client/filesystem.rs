use std::fs;
use std::path::Path;

pub(super) fn read_repo_text_file(
    repo_root: &Path,
    path: &str,
    line: Option<usize>,
    limit: Option<usize>,
) -> Result<String, String> {
    let requested_path = Path::new(path);
    if !requested_path.is_absolute() {
        return Err("External agent file read path must be absolute.".to_string());
    }
    let canonical_path =
        fs::canonicalize(requested_path).map_err(|e| format!("Could not read {}: {}", path, e))?;
    if !canonical_path.starts_with(repo_root) {
        return Err("External agent file read is outside the active repository.".to_string());
    }
    if !canonical_path.is_file() {
        return Err("External agent file read target is not a file.".to_string());
    }

    let content = fs::read_to_string(&canonical_path)
        .map_err(|e| format!("Could not read {} as UTF-8 text: {}", path, e))?;
    Ok(slice_text_lines(&content, line, limit))
}

fn slice_text_lines(content: &str, line: Option<usize>, limit: Option<usize>) -> String {
    let start = line.unwrap_or(1).saturating_sub(1);
    let lines = content.lines().skip(start);
    match limit {
        Some(limit) => lines.take(limit).collect::<Vec<_>>().join("\n"),
        None => lines.collect::<Vec<_>>().join("\n"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scoped_file_read_allows_repo_file() {
        let temp_dir = tempfile::tempdir().expect("temp repo");
        let file_path = temp_dir.path().join("README.md");
        fs::write(&file_path, "one\ntwo\nthree\n").expect("write file");
        let repo_root = fs::canonicalize(temp_dir.path()).expect("canonical repo");

        let content =
            read_repo_text_file(&repo_root, &file_path.to_string_lossy(), Some(2), Some(1))
                .expect("read repo file");

        assert_eq!(content, "two");
    }

    #[test]
    fn scoped_file_read_rejects_outside_file() {
        let repo_dir = tempfile::tempdir().expect("temp repo");
        let outside_dir = tempfile::tempdir().expect("outside temp");
        let outside_file = outside_dir.path().join("secret.txt");
        fs::write(&outside_file, "secret").expect("write file");
        let repo_root = fs::canonicalize(repo_dir.path()).expect("canonical repo");

        let error = read_repo_text_file(&repo_root, &outside_file.to_string_lossy(), None, None)
            .expect_err("reject outside file");

        assert!(error.contains("outside the active repository"));
    }
}
