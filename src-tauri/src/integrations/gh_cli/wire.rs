use super::super::{
    GitHubPullRequestBranch, GitHubPullRequestComment, GitHubPullRequestCommentKind,
    GitHubPullRequestCommit, GitHubPullRequestListItem, GitHubPullRequestReviewCommentDraft,
    GitHubPullRequestUser, GitHubRepository, GitHubSubmittedPullRequestReview,
};
use serde::{Deserialize, Serialize};

#[cfg(test)]
#[derive(Debug, Deserialize)]
pub(super) struct GhUserResponse {
    pub login: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct GhPullRequestListItem {
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub is_draft: bool,
    pub url: String,
    pub author: Option<GhUser>,
    pub base_ref_name: String,
    pub head_ref_name: String,
    pub head_ref_oid: String,
    pub head_repository: Option<GhRepository>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct GhRepository {
    pub name_with_owner: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(super) struct GhPullRequestCommitsResponse {
    pub commits: Vec<GhPullRequestCommit>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct GhPullRequestCommit {
    pub oid: String,
    pub message_headline: String,
    #[serde(default)]
    pub message_body: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct GhUser {
    pub login: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(super) struct IssueCommentResponse {
    pub id: u64,
    pub user: Option<GhUser>,
    pub body: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct ReviewCommentResponse {
    pub id: u64,
    pub user: Option<GhUser>,
    pub body: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: Option<String>,
    pub path: Option<String>,
    pub side: Option<String>,
    pub line: Option<u64>,
    pub original_line: Option<u64>,
    pub diff_hunk: Option<String>,
    pub subject_type: Option<String>,
    pub in_reply_to_id: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ReviewThreadMetadata {
    pub thread_id: String,
    pub resolved: bool,
}

#[derive(Debug, Deserialize)]
pub(super) struct GhRepositoryMergeOptions {
    pub allow_merge_commit: Option<bool>,
    pub allow_squash_merge: Option<bool>,
    pub allow_rebase_merge: Option<bool>,
}

#[derive(Debug, Serialize)]
pub(super) struct SubmitReviewCommentPayload {
    pub path: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub side: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u64>,
}

#[derive(Debug, Serialize)]
pub(super) struct SubmitFileReviewCommentPayload {
    pub path: String,
    pub body: String,
    pub subject_type: String,
}

#[derive(Debug, Serialize)]
pub(super) struct SubmitReviewPayload {
    pub event: super::super::GitHubPullRequestReviewEvent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub comments: Vec<SubmitReviewCommentPayload>,
}

#[derive(Debug, Serialize)]
pub(super) struct UpdateCommentPayload {
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct SubmittedReviewResponse {
    pub id: u64,
    pub state: String,
    pub html_url: Option<String>,
}

impl From<GhUser> for GitHubPullRequestUser {
    fn from(user: GhUser) -> Self {
        Self {
            login: user.login,
            avatar_url: user.avatar_url,
        }
    }
}

impl From<GhPullRequestCommit> for GitHubPullRequestCommit {
    fn from(commit: GhPullRequestCommit) -> Self {
        let message = if commit.message_body.trim().is_empty() {
            commit.message_headline.clone()
        } else {
            format!("{}\n\n{}", commit.message_headline, commit.message_body)
        };

        Self {
            sha: commit.oid,
            message,
            message_headline: commit.message_headline,
            message_body: commit.message_body,
        }
    }
}

impl From<IssueCommentResponse> for GitHubPullRequestComment {
    fn from(comment: IssueCommentResponse) -> Self {
        Self {
            id: comment.id,
            kind: GitHubPullRequestCommentKind::Conversation,
            author: comment.user.map(Into::into),
            body: comment.body.unwrap_or_default(),
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            path: None,
            side: None,
            line: None,
            original_line: None,
            diff_hunk: None,
            subject_type: None,
            in_reply_to_id: None,
            review_thread_id: None,
            review_thread_resolved: None,
        }
    }
}

impl From<ReviewCommentResponse> for GitHubPullRequestComment {
    fn from(comment: ReviewCommentResponse) -> Self {
        Self {
            id: comment.id,
            kind: GitHubPullRequestCommentKind::Review,
            author: comment.user.map(Into::into),
            body: comment.body.unwrap_or_default(),
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            path: comment.path,
            side: comment.side,
            line: comment.line,
            original_line: comment.original_line,
            diff_hunk: comment.diff_hunk,
            subject_type: comment.subject_type,
            in_reply_to_id: comment.in_reply_to_id,
            review_thread_id: None,
            review_thread_resolved: None,
        }
    }
}

impl From<GitHubPullRequestReviewCommentDraft> for SubmitReviewCommentPayload {
    fn from(comment: GitHubPullRequestReviewCommentDraft) -> Self {
        Self {
            path: comment.path,
            body: comment.body,
            side: comment.side,
            line: comment.line,
        }
    }
}

impl From<SubmittedReviewResponse> for GitHubSubmittedPullRequestReview {
    fn from(review: SubmittedReviewResponse) -> Self {
        Self {
            id: review.id,
            state: review.state,
            html_url: review.html_url,
        }
    }
}

pub(super) fn pull_request_from_gh(
    repository: &GitHubRepository,
    pull: GhPullRequestListItem,
) -> GitHubPullRequestListItem {
    let repository_full_name = pull
        .head_repository
        .and_then(|repo| repo.name_with_owner)
        .or_else(|| Some(format!("{}/{}", repository.owner, repository.name)));

    GitHubPullRequestListItem {
        number: pull.number,
        title: pull.title,
        body: pull.body,
        state: pull.state,
        draft: pull.is_draft,
        html_url: pull.url,
        user: pull.author.map(Into::into),
        base: GitHubPullRequestBranch {
            label: format!("{}:{}", repository.owner, pull.base_ref_name),
            ref_name: pull.base_ref_name,
            sha: String::new(),
            repository_full_name: Some(format!("{}/{}", repository.owner, repository.name)),
        },
        head: GitHubPullRequestBranch {
            label: pull.head_ref_name.clone(),
            ref_name: pull.head_ref_name,
            sha: pull.head_ref_oid,
            repository_full_name,
        },
        created_at: pull.created_at,
        updated_at: pull.updated_at,
    }
}
