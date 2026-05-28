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
pub enum GitHubAccessMethod {
    #[serde(rename = "oauth", alias = "oAuth")]
    OAuth,
    GhCli,
    AutoFallback,
}

impl Default for GitHubAccessMethod {
    fn default() -> Self {
        Self::AutoFallback
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitHubCliAvailability {
    NotInstalled,
    NotAuthenticated,
    Ready,
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
pub struct GitHubOAuthStatus {
    pub status: IntegrationConnectionStatus,
    pub connection: Option<ProviderConnectionSummary>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubCliStatus {
    pub availability: GitHubCliAvailability,
    pub version: Option<String>,
    pub connection: Option<ProviderConnectionSummary>,
    pub message: Option<String>,
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
    pub selected_access_method: Option<GitHubAccessMethod>,
    pub oauth: Option<GitHubOAuthStatus>,
    pub gh_cli: Option<GitHubCliStatus>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSetAccessMethodRequest {
    pub access_method: GitHubAccessMethod,
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
pub enum PullRequestProviderId {
    #[serde(rename = "github")]
    GitHub,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRepositoryRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
}

impl From<ProviderRepositoryRequest> for GitHubRepositoryRequest {
    fn from(request: ProviderRepositoryRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
        }
    }
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
    pub body: Option<String>,
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
pub struct GitHubPullRequestCommit {
    pub sha: String,
    pub message: String,
    pub message_headline: String,
    pub message_body: String,
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
pub struct ProviderPullRequestNumberRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
}

impl From<ProviderPullRequestNumberRequest> for GitHubPullRequestNumberRequest {
    fn from(request: ProviderPullRequestNumberRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
            number: request.number,
        }
    }
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
pub struct ProviderPreparePullRequestRefsRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub base_ref: String,
}

impl From<ProviderPreparePullRequestRefsRequest> for GitHubPreparePullRequestRefsRequest {
    fn from(request: ProviderPreparePullRequestRefsRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
            number: request.number,
            base_ref: request.base_ref,
        }
    }
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
    pub subject_type: Option<String>,
    pub in_reply_to_id: Option<u64>,
    pub review_thread_id: Option<String>,
    pub review_thread_resolved: Option<bool>,
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
    pub side: Option<String>,
    pub line: Option<u64>,
    pub subject_type: Option<String>,
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
pub struct ProviderSubmitPullRequestReviewRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub event: GitHubPullRequestReviewEvent,
    pub body: Option<String>,
    pub comments: Vec<GitHubPullRequestReviewCommentDraft>,
}

impl From<ProviderSubmitPullRequestReviewRequest> for GitHubSubmitPullRequestReviewRequest {
    fn from(request: ProviderSubmitPullRequestReviewRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
            number: request.number,
            event: request.event,
            body: request.body,
            comments: request.comments,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSubmitPullRequestConversationCommentRequest {
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSubmitPullRequestConversationCommentRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub body: String,
}

impl From<ProviderSubmitPullRequestConversationCommentRequest>
    for GitHubSubmitPullRequestConversationCommentRequest
{
    fn from(request: ProviderSubmitPullRequestConversationCommentRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
            number: request.number,
            body: request.body,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSubmittedPullRequestReview {
    pub id: u64,
    pub state: String,
    pub html_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GitHubMergeMethod {
    Merge,
    Squash,
    Rebase,
}

impl GitHubMergeMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Merge => "merge",
            Self::Squash => "squash",
            Self::Rebase => "rebase",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepositoryMergeOptionsRequest {
    pub path: String,
    pub remote_name: Option<String>,
}

pub type ProviderRepositoryMergeOptionsRequest = ProviderRepositoryRequest;

impl From<ProviderRepositoryMergeOptionsRequest> for GitHubRepositoryMergeOptionsRequest {
    fn from(request: ProviderRepositoryMergeOptionsRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepositoryMergeOptions {
    pub merge_commit: bool,
    pub squash: bool,
    pub rebase: bool,
}

impl GitHubRepositoryMergeOptions {
    pub fn from_optional_provider_flags(
        merge_commit: Option<bool>,
        squash: Option<bool>,
        rebase: Option<bool>,
    ) -> Self {
        if merge_commit.is_none() && squash.is_none() && rebase.is_none() {
            return Self {
                merge_commit: true,
                squash: true,
                rebase: true,
            };
        }

        Self {
            merge_commit: merge_commit.unwrap_or(false),
            squash: squash.unwrap_or(false),
            rebase: rebase.unwrap_or(false),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubMergePullRequestRequest {
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub merge_method: GitHubMergeMethod,
    pub title: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderMergePullRequestRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub merge_method: GitHubMergeMethod,
    pub title: Option<String>,
    pub body: Option<String>,
}

impl From<ProviderMergePullRequestRequest> for GitHubMergePullRequestRequest {
    fn from(request: ProviderMergePullRequestRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
            number: request.number,
            merge_method: request.merge_method,
            title: request.title,
            body: request.body,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubMergedPullRequest {
    pub sha: Option<String>,
    pub merged: bool,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubUpdatePullRequestCommentRequest {
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub comment_id: u64,
    pub kind: GitHubPullRequestCommentKind,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUpdatePullRequestCommentRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub comment_id: u64,
    pub kind: GitHubPullRequestCommentKind,
    pub body: String,
}

impl From<ProviderUpdatePullRequestCommentRequest> for GitHubUpdatePullRequestCommentRequest {
    fn from(request: ProviderUpdatePullRequestCommentRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
            number: request.number,
            comment_id: request.comment_id,
            kind: request.kind,
            body: request.body,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubSubmitPullRequestReviewReplyRequest {
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub comment_id: u64,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSubmitPullRequestReviewReplyRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub comment_id: u64,
    pub body: String,
}

impl From<ProviderSubmitPullRequestReviewReplyRequest>
    for GitHubSubmitPullRequestReviewReplyRequest
{
    fn from(request: ProviderSubmitPullRequestReviewReplyRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
            number: request.number,
            comment_id: request.comment_id,
            body: request.body,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubResolvePullRequestReviewThreadRequest {
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub thread_id: String,
    pub resolved: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderResolvePullRequestReviewThreadRequest {
    pub provider_id: PullRequestProviderId,
    pub path: String,
    pub remote_name: Option<String>,
    pub number: u64,
    pub thread_id: String,
    pub resolved: bool,
}

impl From<ProviderResolvePullRequestReviewThreadRequest>
    for GitHubResolvePullRequestReviewThreadRequest
{
    fn from(request: ProviderResolvePullRequestReviewThreadRequest) -> Self {
        Self {
            path: request.path,
            remote_name: request.remote_name,
            number: request.number,
            thread_id: request.thread_id,
            resolved: request.resolved,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPullRequestReviewThreadState {
    pub thread_id: String,
    pub resolved: bool,
}
