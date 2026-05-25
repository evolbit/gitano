use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProviderCapability {
    PullRequests,
    PullRequestReviews,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IntegrationConnectionStatus {
    Disconnected,
    Connected,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectionSummary {
    pub account_login: String,
    pub avatar_url: Option<String>,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderIntegration {
    pub id: String,
    pub display_name: String,
    pub capabilities: Vec<ProviderCapability>,
    pub status: IntegrationConnectionStatus,
    pub connection: Option<ProviderConnectionSummary>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubOAuthStartResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubOAuthCompleteRequest {
    pub device_code: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepository {
    pub owner: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepositoryRequest {
    pub path: String,
    pub remote_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPullRequestCount {
    pub repository: GitHubRepository,
    pub count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPullRequestUser {
    pub login: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPullRequestBranch {
    pub label: String,
    pub ref_name: String,
    pub sha: String,
    pub repository_full_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPullRequestListItem {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub draft: bool,
    pub html_url: String,
    pub user: Option<GitHubPullRequestUser>,
    pub base: GitHubPullRequestBranch,
    pub head: GitHubPullRequestBranch,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPullRequestNumberRequest {
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPreparePullRequestRefsRequest {
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub base_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPreparedPullRequestRefs {
    pub base_ref: String,
    pub head_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitHubPullRequestCommentKind {
    Conversation,
    Review,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPullRequestComment {
    pub id: u64,
    pub kind: GitHubPullRequestCommentKind,
    pub author: Option<GitHubPullRequestUser>,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub path: Option<String>,
    pub side: Option<String>,
    pub line: Option<u64>,
    pub original_line: Option<u64>,
    pub diff_hunk: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GitHubPullRequestReviewEvent {
    Approve,
    RequestChanges,
    Comment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPullRequestReviewCommentDraft {
    pub path: String,
    pub body: String,
    pub side: String,
    pub line: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSubmitPullRequestReviewRequest {
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub event: GitHubPullRequestReviewEvent,
    pub body: Option<String>,
    pub comments: Vec<GitHubPullRequestReviewCommentDraft>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSubmittedPullRequestReview {
    pub id: u64,
    pub state: String,
    pub html_url: Option<String>,
}
