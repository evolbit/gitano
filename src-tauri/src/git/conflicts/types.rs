use crate::git::types::ChangeType;
use serde::{Deserialize, Serialize};

pub const NORMAL_TEXT_LINE_LIMIT: usize = 5_000;
pub const VERY_LARGE_TEXT_LINE_LIMIT: usize = 50_000;
pub const NORMAL_TEXT_BYTE_LIMIT: usize = 1_000_000;
pub const VERY_LARGE_TEXT_BYTE_LIMIT: usize = 10_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitConflictSide {
    Base,
    Current,
    Incoming,
    Result,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitConflictContentKind {
    Text,
    Binary,
    Missing,
    Symlink,
    Submodule,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitConflictKind {
    BothModified,
    AddAdd,
    DeletedByCurrent,
    DeletedByIncoming,
    Binary,
    Symlink,
    Submodule,
    MissingStage,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitConflictSizeClass {
    Normal,
    Large,
    VeryLarge,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitConflictLineEnding {
    Lf,
    Crlf,
    Mixed,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConflictSize {
    pub byte_size: usize,
    pub line_count: usize,
    pub size_class: GitConflictSizeClass,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConflictVersion {
    pub side: GitConflictSide,
    pub content_kind: GitConflictContentKind,
    pub text: Option<String>,
    pub size: GitConflictSize,
    pub line_ending: GitConflictLineEnding,
    pub has_final_newline: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConflictRegion {
    pub id: String,
    pub result_start_line: usize,
    pub result_separator_line: Option<usize>,
    pub result_end_line: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConflictSignatures {
    pub index_signature: String,
    pub result_signature: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConflictSummary {
    pub path: String,
    pub status: ChangeType,
    pub conflict_count: usize,
    pub conflict_kinds: Vec<GitConflictKind>,
    pub content_kind: GitConflictContentKind,
    pub size: GitConflictSize,
    pub file_signature: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConflictFileDetail {
    pub path: String,
    pub status: ChangeType,
    pub base: Option<GitConflictVersion>,
    pub current: Option<GitConflictVersion>,
    pub incoming: Option<GitConflictVersion>,
    pub result: GitConflictVersion,
    pub regions: Vec<GitConflictRegion>,
    pub conflict_kinds: Vec<GitConflictKind>,
    pub content_kind: GitConflictContentKind,
    pub signatures: GitConflictSignatures,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConflictContentRange {
    pub path: String,
    pub side: GitConflictSide,
    pub start_line: usize,
    pub lines: Vec<String>,
    pub total_line_count: usize,
    pub signature: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ConflictStageEntry {
    pub mode: String,
    pub object_id: String,
    pub stage: u8,
    pub path: String,
}
