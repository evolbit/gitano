use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RepositoryHeadStatus {
    Normal,
    Unborn,
    Detached,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryState {
    pub path: String,
    pub is_valid: bool,
    pub branch: Option<String>,
    pub head_status: RepositoryHeadStatus,
    pub has_commits: bool,
    pub is_unborn: bool,
    pub is_detached: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitGraphSegment {
    pub color_idx: usize,
    pub from_lane: f32,
    pub from_y: f32,
    pub to_lane: f32,
    pub to_y: f32,
    pub control_lane: Option<f32>,
    pub control_y: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitListItem {
    pub sha: String,
    pub parents: Vec<String>,
    pub graph_width: usize,
    pub graph_lane: usize,
    pub graph_color: usize,
    pub graph_segments: Vec<CommitGraphSegment>,
    pub refs: Vec<String>,
    pub message: String,
    pub author: String,
    pub author_initial: String,
    pub author_avatar_url: Option<String>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagCommitOption {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub date: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TagRefStatus {
    LocalOrigin,
    Local,
    Origin,
    Conflict,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitTagRef {
    pub name: String,
    pub local_object_id: Option<String>,
    pub origin_object_id: Option<String>,
    pub local_target_id: Option<String>,
    pub origin_target_id: Option<String>,
    pub status: TagRefStatus,
    pub is_local_annotated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitTagRefsResponse {
    pub tags: Vec<GitTagRef>,
    pub origin_available: bool,
    pub origin_error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagNameAvailability {
    pub valid_name: bool,
    pub local_exists: bool,
    pub origin_exists: Option<bool>,
    pub origin_available: bool,
    pub origin_error: Option<String>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktree {
    pub path: String,
    pub name: String,
    pub branch: Option<String>,
    pub head: Option<String>,
    pub is_current: bool,
    pub is_main: bool,
    pub is_bare: bool,
    pub is_detached: bool,
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

#[cfg(test)]
mod tests {
    use super::*;

    mod change_type {
        use super::*;

        #[test]
        fn serializes_with_lowercase_names() {
            let serialized =
                serde_json::to_string(&ChangeType::Added).expect("status should serialize");

            assert_eq!(serialized, "\"added\"");
        }
    }

    mod staged_file_selection_state {
        use super::*;

        #[test]
        fn skips_absent_flags_and_uses_camel_case_for_present_flags() {
            let state = StagedFileSelectionState {
                is_new_file: Some(true),
                is_whole_file_staged: None,
                hunks: HashMap::new(),
            };

            let serialized = serde_json::to_value(state).expect("staged state should serialize");

            assert_eq!(
                serialized,
                serde_json::json!({
                    "isNewFile": true,
                    "hunks": {}
                })
            );
        }
    }

    mod repo_change_kind {
        use super::*;

        #[test]
        fn serializes_with_kebab_case_names() {
            let serialized =
                serde_json::to_string(&RepoChangeKind::RemoteRefs).expect("kind should serialize");

            assert_eq!(serialized, "\"remote-refs\"");
        }
    }
}
