mod detail;
mod list;
mod resolve;
pub mod types;

pub use detail::*;
pub use list::*;
pub use resolve::*;

use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::UNIX_EPOCH;
use types::{
    ConflictStageEntry, GitConflictContentKind, GitConflictKind, GitConflictLineEnding,
    GitConflictSide, GitConflictSize, GitConflictSizeClass, GitConflictVersion,
    NORMAL_TEXT_BYTE_LIMIT, NORMAL_TEXT_LINE_LIMIT, VERY_LARGE_TEXT_BYTE_LIMIT,
    VERY_LARGE_TEXT_LINE_LIMIT,
};

fn digest_parts(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update([0]);
    }
    format!("sha256:{:x}", hasher.finalize())
}

fn run_git(path: &str, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(output.stdout);
    }

    Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
}

fn parse_unmerged_entries(output: &[u8]) -> Vec<ConflictStageEntry> {
    String::from_utf8_lossy(output)
        .split('\0')
        .filter(|record| !record.is_empty())
        .filter_map(|record| {
            let (metadata, path) = record.split_once('\t')?;
            let mut metadata_parts = metadata.split_whitespace();
            let mode = metadata_parts.next()?.to_string();
            let object_id = metadata_parts.next()?.to_string();
            let stage = metadata_parts.next()?.parse::<u8>().ok()?;

            Some(ConflictStageEntry {
                mode,
                object_id,
                stage,
                path: path.to_string(),
            })
        })
        .collect()
}

fn load_unmerged_entries(path: &str) -> Result<Vec<ConflictStageEntry>, String> {
    run_git(path, &["ls-files", "-u", "-z"]).map(|output| parse_unmerged_entries(&output))
}

fn entries_by_path(entries: Vec<ConflictStageEntry>) -> BTreeMap<String, Vec<ConflictStageEntry>> {
    let mut by_path: BTreeMap<String, Vec<ConflictStageEntry>> = BTreeMap::new();
    for entry in entries {
        by_path.entry(entry.path.clone()).or_default().push(entry);
    }
    by_path
}

fn stages_for_entries(entries: &[ConflictStageEntry]) -> BTreeSet<u8> {
    entries.iter().map(|entry| entry.stage).collect()
}

fn entry_for_stage(entries: &[ConflictStageEntry], stage: u8) -> Option<&ConflictStageEntry> {
    entries.iter().find(|entry| entry.stage == stage)
}

fn conflict_kinds(entries: &[ConflictStageEntry], content_kind: GitConflictContentKind) -> Vec<GitConflictKind> {
    if content_kind == GitConflictContentKind::Binary {
        return vec![GitConflictKind::Binary];
    }
    if content_kind == GitConflictContentKind::Symlink {
        return vec![GitConflictKind::Symlink];
    }
    if content_kind == GitConflictContentKind::Submodule {
        return vec![GitConflictKind::Submodule];
    }

    let stages = stages_for_entries(entries);
    match (
        stages.contains(&1),
        stages.contains(&2),
        stages.contains(&3),
    ) {
        (true, true, true) => vec![GitConflictKind::BothModified],
        (false, true, true) => vec![GitConflictKind::AddAdd],
        (true, false, true) => vec![GitConflictKind::DeletedByCurrent],
        (true, true, false) => vec![GitConflictKind::DeletedByIncoming],
        _ => vec![GitConflictKind::MissingStage],
    }
}

fn mode_content_kind(mode: &str) -> Option<GitConflictContentKind> {
    match mode {
        "120000" => Some(GitConflictContentKind::Symlink),
        "160000" => Some(GitConflictContentKind::Submodule),
        _ => None,
    }
}

fn bytes_are_binary(bytes: &[u8]) -> bool {
    bytes.iter().any(|byte| *byte == 0)
}

fn detect_line_ending(text: &str) -> GitConflictLineEnding {
    let has_crlf = text.contains("\r\n");
    let without_crlf = text.replace("\r\n", "");
    let has_lf = without_crlf.contains('\n');

    match (has_crlf, has_lf) {
        (true, true) => GitConflictLineEnding::Mixed,
        (true, false) => GitConflictLineEnding::Crlf,
        (false, true) => GitConflictLineEnding::Lf,
        (false, false) => GitConflictLineEnding::None,
    }
}

fn count_lines(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    text.lines().count()
}

fn classify_size(line_count: usize, byte_size: usize) -> GitConflictSizeClass {
    if line_count > VERY_LARGE_TEXT_LINE_LIMIT || byte_size > VERY_LARGE_TEXT_BYTE_LIMIT {
        GitConflictSizeClass::VeryLarge
    } else if line_count > NORMAL_TEXT_LINE_LIMIT || byte_size > NORMAL_TEXT_BYTE_LIMIT {
        GitConflictSizeClass::Large
    } else {
        GitConflictSizeClass::Normal
    }
}

fn analyze_bytes(side: GitConflictSide, bytes: Vec<u8>, forced_kind: Option<GitConflictContentKind>) -> GitConflictVersion {
    let byte_size = bytes.len();
    let content_kind = forced_kind.unwrap_or_else(|| {
        if bytes_are_binary(&bytes) {
            GitConflictContentKind::Binary
        } else {
            GitConflictContentKind::Text
        }
    });

    if content_kind != GitConflictContentKind::Text {
        return GitConflictVersion {
            side,
            content_kind,
            text: None,
            size: GitConflictSize {
                byte_size,
                line_count: 0,
                size_class: classify_size(0, byte_size),
            },
            line_ending: GitConflictLineEnding::None,
            has_final_newline: false,
        };
    }

    match String::from_utf8(bytes) {
        Ok(text) => {
            let line_count = count_lines(&text);
            let line_ending = detect_line_ending(&text);
            let has_final_newline = text.ends_with('\n');
            GitConflictVersion {
                side,
                content_kind: GitConflictContentKind::Text,
                text: Some(text),
                size: GitConflictSize {
                    byte_size,
                    line_count,
                    size_class: classify_size(line_count, byte_size),
                },
                line_ending,
                has_final_newline,
            }
        }
        Err(error) => GitConflictVersion {
            side,
            content_kind: GitConflictContentKind::Binary,
            text: None,
            size: GitConflictSize {
                byte_size: error.as_bytes().len(),
                line_count: 0,
                size_class: classify_size(0, error.as_bytes().len()),
            },
            line_ending: GitConflictLineEnding::None,
            has_final_newline: false,
        },
    }
}

fn missing_version(side: GitConflictSide) -> GitConflictVersion {
    GitConflictVersion {
        side,
        content_kind: GitConflictContentKind::Missing,
        text: None,
        size: GitConflictSize {
            byte_size: 0,
            line_count: 0,
            size_class: GitConflictSizeClass::Normal,
        },
        line_ending: GitConflictLineEnding::None,
        has_final_newline: false,
    }
}

fn load_stage_version(
    repo_path: &str,
    file_path: &str,
    side: GitConflictSide,
    stage: u8,
    entries: &[ConflictStageEntry],
) -> Option<GitConflictVersion> {
    let entry = entry_for_stage(entries, stage)?;
    let forced_kind = mode_content_kind(&entry.mode);
    let spec = format!(":{stage}:{file_path}");
    let bytes = run_git(repo_path, &["show", &spec]).ok()?;
    Some(analyze_bytes(side, bytes, forced_kind))
}

fn load_result_version(repo_path: &str, file_path: &str) -> GitConflictVersion {
    let full_path = Path::new(repo_path).join(file_path);
    let Ok(metadata) = fs::symlink_metadata(&full_path) else {
        return missing_version(GitConflictSide::Result);
    };

    if metadata.file_type().is_symlink() {
        return analyze_bytes(
            GitConflictSide::Result,
            fs::read_link(&full_path)
                .map(|path| path.to_string_lossy().as_bytes().to_vec())
                .unwrap_or_default(),
            Some(GitConflictContentKind::Symlink),
        );
    }

    if metadata.is_dir() {
        return analyze_bytes(
            GitConflictSide::Result,
            Vec::new(),
            Some(GitConflictContentKind::Submodule),
        );
    }

    fs::read(&full_path)
        .map(|bytes| analyze_bytes(GitConflictSide::Result, bytes, None))
        .unwrap_or_else(|_| missing_version(GitConflictSide::Result))
}

fn index_signature(entries: &[ConflictStageEntry]) -> String {
    let mut parts = vec!["conflict-index".to_string()];
    let mut sorted = entries.to_vec();
    sorted.sort_by(|a, b| a.stage.cmp(&b.stage));

    for entry in sorted {
        parts.push(format!(
            "{}:{}:{}:{}",
            entry.stage, entry.mode, entry.object_id, entry.path
        ));
    }

    let refs: Vec<&str> = parts.iter().map(String::as_str).collect();
    digest_parts(&refs)
}

fn result_signature(repo_path: &str, file_path: &str) -> String {
    let full_path = Path::new(repo_path).join(file_path);
    let Ok(metadata) = fs::symlink_metadata(&full_path) else {
        return digest_parts(&["result", file_path, "missing"]);
    };

    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let len = metadata.len().to_string();
    let kind = if metadata.file_type().is_symlink() {
        "symlink"
    } else if metadata.is_dir() {
        "dir"
    } else {
        "file"
    };

    digest_parts(&["result", file_path, kind, &len, &modified])
}

fn assert_current_signatures(
    repo_path: &str,
    file_path: &str,
    expected_index_signature: &str,
    expected_result_signature: &str,
) -> Result<Vec<ConflictStageEntry>, String> {
    let entries = load_unmerged_entries(repo_path)?;
    let grouped = entries_by_path(entries);
    let Some(file_entries) = grouped.get(file_path) else {
        return Err("Conflict state changed. Reload conflict details.".to_string());
    };

    if index_signature(file_entries) != expected_index_signature
        || result_signature(repo_path, file_path) != expected_result_signature
    {
        return Err("Conflict state changed. Reload conflict details.".to_string());
    }

    Ok(file_entries.clone())
}

fn write_worktree_file(repo_path: &str, file_path: &str, content: &str) -> Result<(), String> {
    let full_path = Path::new(repo_path).join(file_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(full_path, content).map_err(|e| e.to_string())
}

fn remove_worktree_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let full_path = Path::new(repo_path).join(file_path);
    let Ok(metadata) = fs::symlink_metadata(&full_path) else {
        return Ok(());
    };

    if metadata.is_dir() && !metadata.file_type().is_symlink() {
        fs::remove_dir_all(full_path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(full_path).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::conflicts::{
        get_merge_conflict_file, get_merge_conflicts, git_accept_conflict_side,
        git_mark_conflict_resolved, git_write_conflict_result,
    };
    use crate::git::conflicts::types::{
        GitConflictContentKind, GitConflictKind, GitConflictLineEnding, GitConflictSide,
    };
    use crate::git::test_support::{commit_file, init_repo, run_git, write_file};
    use std::process::Command;

    fn run_git_expect_failure(repo_path: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .args(args)
            .output()
            .expect("git command should run");

        assert!(
            !output.status.success(),
            "git {:?} should fail\nstdout: {}\nstderr: {}",
            args,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn create_both_modified_conflict() -> tempfile::TempDir {
        let repo = init_repo();
        commit_file(repo.path(), "target.txt", "one\nbase\n", "base");
        run_git(repo.path(), &["checkout", "-b", "incoming"]);
        commit_file(repo.path(), "target.txt", "one\nincoming\n", "incoming");
        run_git(repo.path(), &["checkout", "main"]);
        commit_file(repo.path(), "target.txt", "one\ncurrent\n", "current");
        run_git_expect_failure(repo.path(), &["merge", "incoming"]);
        repo
    }

    #[test]
    fn lists_and_loads_both_modified_text_conflict() {
        let repo = create_both_modified_conflict();
        let repo_path = repo.path().to_string_lossy().to_string();

        let conflicts = get_merge_conflicts(repo_path.clone()).expect("conflicts should load");
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].path, "target.txt");
        assert_eq!(conflicts[0].status, crate::git::types::ChangeType::Conflicted);
        assert_eq!(conflicts[0].conflict_kinds, vec![GitConflictKind::BothModified]);

        let detail = get_merge_conflict_file(repo_path, "target.txt".to_string())
            .expect("detail should load");

        assert!(detail
            .base
            .and_then(|version| version.text)
            .expect("base text")
            .contains("base"));
        assert!(detail
            .current
            .and_then(|version| version.text)
            .expect("current text")
            .contains("current"));
        assert!(detail
            .incoming
            .and_then(|version| version.text)
            .expect("incoming text")
            .contains("incoming"));
        assert_eq!(detail.regions.len(), 1);
    }

    #[test]
    fn detects_add_add_conflict_without_base_stage() {
        let repo = init_repo();
        commit_file(repo.path(), "README.md", "base\n", "base");
        run_git(repo.path(), &["checkout", "-b", "incoming"]);
        commit_file(repo.path(), "target.txt", "incoming\n", "incoming add");
        run_git(repo.path(), &["checkout", "main"]);
        commit_file(repo.path(), "target.txt", "current\n", "current add");
        run_git_expect_failure(repo.path(), &["merge", "incoming"]);

        let detail = get_merge_conflict_file(
            repo.path().to_string_lossy().to_string(),
            "target.txt".to_string(),
        )
        .expect("detail should load");

        assert!(detail.base.is_none());
        assert_eq!(detail.conflict_kinds, vec![GitConflictKind::AddAdd]);
    }

    #[test]
    fn detects_modify_delete_conflict() {
        let repo = init_repo();
        commit_file(repo.path(), "target.txt", "base\n", "base");
        run_git(repo.path(), &["checkout", "-b", "incoming"]);
        run_git(repo.path(), &["rm", "target.txt"]);
        run_git(repo.path(), &["commit", "-m", "delete incoming"]);
        run_git(repo.path(), &["checkout", "main"]);
        commit_file(repo.path(), "target.txt", "current\n", "current");
        run_git_expect_failure(repo.path(), &["merge", "incoming"]);

        let detail = get_merge_conflict_file(
            repo.path().to_string_lossy().to_string(),
            "target.txt".to_string(),
        )
        .expect("detail should load");

        assert_eq!(
            detail.conflict_kinds,
            vec![GitConflictKind::DeletedByIncoming]
        );
        assert!(detail.incoming.is_none());
    }

    #[test]
    fn accepts_deleted_side_for_modify_delete_conflict() {
        let repo = init_repo();
        commit_file(repo.path(), "target.txt", "base\n", "base");
        run_git(repo.path(), &["checkout", "-b", "incoming"]);
        run_git(repo.path(), &["rm", "target.txt"]);
        run_git(repo.path(), &["commit", "-m", "delete incoming"]);
        run_git(repo.path(), &["checkout", "main"]);
        commit_file(repo.path(), "target.txt", "current\n", "current");
        run_git_expect_failure(repo.path(), &["merge", "incoming"]);

        let repo_path = repo.path().to_string_lossy().to_string();
        let detail = get_merge_conflict_file(repo_path.clone(), "target.txt".to_string())
            .expect("detail should load");
        let updated = git_accept_conflict_side(
            repo_path.clone(),
            "target.txt".to_string(),
            GitConflictSide::Incoming,
            detail.signatures.index_signature,
            detail.signatures.result_signature,
        )
        .expect("delete side should be accepted");

        assert!(updated.result.text.is_none());
        assert!(!repo.path().join("target.txt").exists());

        git_mark_conflict_resolved(
            repo_path.clone(),
            "target.txt".to_string(),
            updated.signatures.index_signature,
            updated.signatures.result_signature,
        )
        .expect("deleted file should be markable as resolved");

        let conflicts = get_merge_conflicts(repo_path).expect("conflicts should load");
        assert!(conflicts.is_empty());
    }

    #[test]
    fn detects_binary_conflict_content() {
        let repo = init_repo();
        std::fs::write(repo.path().join("target.bin"), [0, 1, 2]).expect("write base");
        run_git(repo.path(), &["add", "target.bin"]);
        run_git(repo.path(), &["commit", "-m", "base"]);
        run_git(repo.path(), &["checkout", "-b", "incoming"]);
        std::fs::write(repo.path().join("target.bin"), [0, 2, 3]).expect("write incoming");
        run_git(repo.path(), &["add", "target.bin"]);
        run_git(repo.path(), &["commit", "-m", "incoming"]);
        run_git(repo.path(), &["checkout", "main"]);
        std::fs::write(repo.path().join("target.bin"), [0, 4, 5]).expect("write current");
        run_git(repo.path(), &["add", "target.bin"]);
        run_git(repo.path(), &["commit", "-m", "current"]);
        run_git_expect_failure(repo.path(), &["merge", "incoming"]);

        let detail = get_merge_conflict_file(
            repo.path().to_string_lossy().to_string(),
            "target.bin".to_string(),
        )
        .expect("detail should load");

        assert_eq!(detail.content_kind, GitConflictContentKind::Binary);
        assert_eq!(detail.conflict_kinds, vec![GitConflictKind::Binary]);
    }

    #[test]
    fn rejects_stale_result_writes() {
        let repo = create_both_modified_conflict();
        let repo_path = repo.path().to_string_lossy().to_string();
        let detail = get_merge_conflict_file(repo_path.clone(), "target.txt".to_string())
            .expect("detail should load");
        write_file(repo.path(), "target.txt", "external edit\n");

        let error = git_write_conflict_result(
            repo_path,
            "target.txt".to_string(),
            "resolved\n".to_string(),
            detail.signatures.index_signature,
            detail.signatures.result_signature,
        )
        .expect_err("stale write should fail");

        assert!(error.contains("Conflict state changed"));
    }

    #[test]
    fn writes_result_and_marks_conflict_resolved() {
        let repo = create_both_modified_conflict();
        let repo_path = repo.path().to_string_lossy().to_string();
        let detail = get_merge_conflict_file(repo_path.clone(), "target.txt".to_string())
            .expect("detail should load");

        let updated = git_write_conflict_result(
            repo_path.clone(),
            "target.txt".to_string(),
            "one\nresolved\n".to_string(),
            detail.signatures.index_signature,
            detail.signatures.result_signature,
        )
        .expect("write should succeed");

        git_mark_conflict_resolved(
            repo_path.clone(),
            "target.txt".to_string(),
            updated.signatures.index_signature,
            updated.signatures.result_signature,
        )
        .expect("mark resolved should succeed");

        let conflicts = get_merge_conflicts(repo_path).expect("conflicts should load");
        assert!(conflicts.is_empty());
    }

    #[test]
    fn rejects_mark_resolved_with_remaining_conflict_markers() {
        let repo = create_both_modified_conflict();
        let repo_path = repo.path().to_string_lossy().to_string();
        let detail = get_merge_conflict_file(repo_path.clone(), "target.txt".to_string())
            .expect("detail should load");

        let error = git_mark_conflict_resolved(
            repo_path.clone(),
            "target.txt".to_string(),
            detail.signatures.index_signature,
            detail.signatures.result_signature,
        )
        .expect_err("mark resolved should reject marker groups");

        assert!(error.contains("remaining conflict markers"));
        let conflicts = get_merge_conflicts(repo_path).expect("conflicts should load");
        assert_eq!(conflicts.len(), 1);
    }

    #[test]
    fn writes_result_content_with_line_endings_and_final_newline() {
        let repo = create_both_modified_conflict();
        let repo_path = repo.path().to_string_lossy().to_string();
        let detail = get_merge_conflict_file(repo_path.clone(), "target.txt".to_string())
            .expect("detail should load");
        let content = "one\r\nresolved\r\n";

        let updated = git_write_conflict_result(
            repo_path,
            "target.txt".to_string(),
            content.to_string(),
            detail.signatures.index_signature,
            detail.signatures.result_signature,
        )
        .expect("write should succeed");

        let written = std::fs::read_to_string(repo.path().join("target.txt"))
            .expect("result file should be readable");
        assert_eq!(written, content);
        assert_eq!(updated.result.line_ending, GitConflictLineEnding::Crlf);
        assert!(updated.result.has_final_newline);
    }
}
