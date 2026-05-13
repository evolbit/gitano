use git2;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(serde::Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
}

#[derive(serde::Serialize)]
pub struct CommitNode {
    pub id: String,
    pub parents: Vec<String>,
    pub message: String,
    pub author: String,
    pub branches: Vec<String>,
    pub is_head: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub date: i64,
    pub message: String,
    pub heads: Vec<String>,
    pub tags: Vec<GitTag>,
    pub remotes: Vec<GitRemote>,
    pub stash: Option<GitStash>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitTag {
    pub name: String,
    pub annotated: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitRemote {
    pub name: String,
    pub remote: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStash {
    pub hash: String,
    pub base_hash: String,
    pub untracked_files_hash: String,
    pub selector: String,
    pub author: String,
    pub email: String,
    pub date: i64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommitData {
    pub commits: Vec<GitCommit>,
    pub head: Option<String>,
    pub tags: Vec<String>,
    pub more_commits_available: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitRefData {
    pub head: Option<String>,
    pub heads: Vec<String>,
    pub tags: Vec<String>,
    pub remotes: Vec<String>,
    pub ci: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum CommitOrdering {
    Date,
    Topo,
    AuthorDate,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitListItem {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub date: i64,
    pub current_branch: String,
    pub source_branch: String,
    pub commit_history: Vec<String>,
    pub files: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitListPage {
    pub commits: Vec<CommitListItem>,
    pub has_more: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CommitHistoryMode {
    GitLog,
    FirstParent,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ChangeType {
    Added,
    Deleted,
    Modified,
    Renamed,
    Copied,
    TypeChanged,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub enum DiffLineKind {
    Add,
    Del,
    Context,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub status: ChangeType,
    pub insertions: u32,
    pub deletions: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitDiff {
    pub commit_sha: String,
    pub changes: Vec<FileChange>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub content: String,
    pub old_lineno: Option<usize>,
    pub new_lineno: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<DiffLine>,
    pub is_new_file: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileChangeWithHunks {
    pub path: String,
    pub status: ChangeType,
    pub insertions: u32,
    pub deletions: u32,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StagedFileSelectionState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_new_file: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_whole_file_staged: Option<bool>,
    #[serde(default)]
    pub hunks: HashMap<usize, Vec<usize>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkingDirectoryChangesResponse {
    pub changes: Vec<FileChangeWithHunks>,
    pub staged_state_by_file: HashMap<String, StagedFileSelectionState>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStashEntry {
    pub selector: String,
    pub hash: String,
    pub message: String,
    pub date: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StashFileChange {
    pub path: String,
    pub status: ChangeType,
    pub insertions: u32,
    pub deletions: u32,
}

#[derive(Deserialize)]
pub enum ContextDirection {
    Above,
    Below,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum RepoChangeKind {
    WorkingTree,
    Index,
    Head,
    Branches,
    Tags,
    Stashes,
    RemoteRefs,
    Config,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepoChangedEvent {
    pub repo_path: String,
    pub kinds: Vec<RepoChangeKind>,
    pub timestamp_ms: i64,
}

impl From<git2::Delta> for ChangeType {
    fn from(delta: git2::Delta) -> Self {
        match delta {
            git2::Delta::Added => ChangeType::Added,
            git2::Delta::Deleted => ChangeType::Deleted,
            git2::Delta::Modified => ChangeType::Modified,
            git2::Delta::Renamed => ChangeType::Renamed,
            git2::Delta::Copied => ChangeType::Copied,
            git2::Delta::Typechange => ChangeType::TypeChanged,
            _ => ChangeType::Modified, // Default or handle other cases
        }
    }
}
