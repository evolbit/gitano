use super::super::{
    GitHubMergeMethod, GitHubMergedPullRequest, GitHubPullRequestComment,
    GitHubPullRequestCommentKind, GitHubPullRequestCommit,
    GitHubPullRequestListItem as PullRequestListItem, GitHubPullRequestReviewCommentDraft,
    GitHubPullRequestReviewEvent, GitHubRepository,
    GitHubRepositoryMergeOptions as RepositoryMergeOptions, GitHubSubmittedPullRequestReview,
};
use super::api::{
    format_gh_error, gh_api_get_with_runner, gh_api_json, gh_api_paginated_with_runner, run_json,
};
use super::review_threads::{
    apply_review_thread_metadata, list_pull_request_review_thread_metadata_with_runner,
};
use super::runner::{GhCommand, GhRunner, ProcessGhRunner};
use super::wire::{
    pull_request_from_gh, GhPullRequestCommitsResponse, GhPullRequestListItem,
    GhRepositoryMergeOptions, IssueCommentResponse, ReviewCommentResponse,
    SubmitFileReviewCommentPayload, SubmitReviewPayload, SubmittedReviewResponse,
    UpdateCommentPayload,
};
use std::path::Path;

pub fn list_open_pull_requests(
    cwd: &Path,
    repository: &GitHubRepository,
) -> Result<Vec<PullRequestListItem>, String> {
    list_open_pull_requests_with_runner(&ProcessGhRunner, cwd, repository)
}

pub(super) fn list_open_pull_requests_with_runner(
    runner: &impl GhRunner,
    cwd: &Path,
    repository: &GitHubRepository,
) -> Result<Vec<PullRequestListItem>, String> {
    let fields = [
        "number",
        "title",
        "body",
        "state",
        "isDraft",
        "url",
        "author",
        "baseRefName",
        "headRefName",
        "headRefOid",
        "headRepository",
        "createdAt",
        "updatedAt",
    ]
    .join(",");
    let pulls = run_json::<Vec<GhPullRequestListItem>>(
        runner,
        Some(cwd),
        GhCommand {
            args: vec![
                "pr".to_string(),
                "list".to_string(),
                "--state".to_string(),
                "open".to_string(),
                "--limit".to_string(),
                "1000".to_string(),
                "--repo".to_string(),
                format!("{}/{}", repository.owner, repository.name),
                "--json".to_string(),
                fields,
            ],
            stdin: None,
        },
    )?;

    Ok(pulls
        .into_iter()
        .map(|pull| pull_request_from_gh(repository, pull))
        .collect())
}

pub fn count_open_pull_requests(
    cwd: &Path,
    repository: &GitHubRepository,
) -> Result<usize, String> {
    list_open_pull_requests(cwd, repository).map(|pulls| pulls.len())
}

pub fn list_pull_request_commits(
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
) -> Result<Vec<GitHubPullRequestCommit>, String> {
    list_pull_request_commits_with_runner(&ProcessGhRunner, cwd, repository, number)
}

pub(super) fn list_pull_request_commits_with_runner(
    runner: &impl GhRunner,
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
) -> Result<Vec<GitHubPullRequestCommit>, String> {
    let response = run_json::<GhPullRequestCommitsResponse>(
        runner,
        Some(cwd),
        GhCommand {
            args: vec![
                "pr".to_string(),
                "view".to_string(),
                number.to_string(),
                "--repo".to_string(),
                format!("{}/{}", repository.owner, repository.name),
                "--json".to_string(),
                "commits".to_string(),
            ],
            stdin: None,
        },
    )?;

    Ok(response.commits.into_iter().map(Into::into).collect())
}

pub fn list_pull_request_comments(
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
) -> Result<Vec<GitHubPullRequestComment>, String> {
    list_pull_request_comments_with_runner(&ProcessGhRunner, cwd, repository, number)
}

pub(super) fn list_pull_request_comments_with_runner(
    runner: &impl GhRunner,
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
) -> Result<Vec<GitHubPullRequestComment>, String> {
    let issue_comments = gh_api_paginated_with_runner::<IssueCommentResponse>(
        runner,
        cwd,
        &format!(
            "repos/{}/{}/issues/{}/comments",
            repository.owner, repository.name, number
        ),
    )?;
    let review_comments = gh_api_paginated_with_runner::<ReviewCommentResponse>(
        runner,
        cwd,
        &format!(
            "repos/{}/{}/pulls/{}/comments",
            repository.owner, repository.name, number
        ),
    )?;
    let comments = issue_comments
        .into_iter()
        .map(Into::into)
        .chain(review_comments.into_iter().map(Into::into))
        .collect();
    let review_thread_metadata =
        list_pull_request_review_thread_metadata_with_runner(runner, cwd, repository, number)
            .unwrap_or_default();

    Ok(apply_review_thread_metadata(
        comments,
        &review_thread_metadata,
    ))
}

pub fn submit_pull_request_review(
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
    event: GitHubPullRequestReviewEvent,
    body: Option<String>,
    comments: Vec<GitHubPullRequestReviewCommentDraft>,
) -> Result<GitHubSubmittedPullRequestReview, String> {
    if comments.is_empty() {
        return submit_top_level_pull_request_review_with_runner(
            &ProcessGhRunner,
            cwd,
            repository,
            number,
            event,
            body,
        );
    }

    let (file_comments, line_comments): (
        Vec<GitHubPullRequestReviewCommentDraft>,
        Vec<GitHubPullRequestReviewCommentDraft>,
    ) = comments
        .into_iter()
        .partition(|comment| comment.subject_type.as_deref() == Some("file"));
    let mut last_file_comment: Option<ReviewCommentResponse> = None;

    for comment in file_comments {
        let payload = SubmitFileReviewCommentPayload {
            path: comment.path,
            body: comment.body,
            subject_type: "file".to_string(),
        };
        last_file_comment = Some(gh_api_json(
            cwd,
            "POST",
            &format!(
                "repos/{}/{}/pulls/{}/comments",
                repository.owner, repository.name, number
            ),
            &payload,
        )?);
    }

    let payload = SubmitReviewPayload {
        event,
        body: body.and_then(|value| {
            let trimmed = value.trim().to_string();
            (!trimmed.is_empty()).then_some(trimmed)
        }),
        comments: line_comments.into_iter().map(Into::into).collect(),
    };
    if payload.comments.is_empty()
        && matches!(payload.event, GitHubPullRequestReviewEvent::Comment)
        && payload.body.is_none()
    {
        if let Some(comment) = last_file_comment {
            return Ok(GitHubSubmittedPullRequestReview {
                id: comment.id,
                state: "COMMENTED".to_string(),
                html_url: comment.html_url,
            });
        }
    }

    gh_api_json::<_, SubmittedReviewResponse>(
        cwd,
        "POST",
        &format!(
            "repos/{}/{}/pulls/{}/reviews",
            repository.owner, repository.name, number
        ),
        &payload,
    )
    .map(Into::into)
}

pub fn merge_pull_request(
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
    merge_method: GitHubMergeMethod,
    title: Option<String>,
    body: Option<String>,
) -> Result<GitHubMergedPullRequest, String> {
    merge_pull_request_with_runner(
        &ProcessGhRunner,
        cwd,
        repository,
        number,
        merge_method,
        title,
        body,
    )
}

pub(super) fn merge_pull_request_with_runner(
    runner: &impl GhRunner,
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
    merge_method: GitHubMergeMethod,
    title: Option<String>,
    body: Option<String>,
) -> Result<GitHubMergedPullRequest, String> {
    let merge_flag = match merge_method {
        GitHubMergeMethod::Merge => "--merge",
        GitHubMergeMethod::Squash => "--squash",
        GitHubMergeMethod::Rebase => "--rebase",
    };
    let mut args = vec![
        "pr".to_string(),
        "merge".to_string(),
        number.to_string(),
        "--repo".to_string(),
        format!("{}/{}", repository.owner, repository.name),
        merge_flag.to_string(),
    ];
    if let Some(title) = title
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        args.push("--subject".to_string());
        args.push(title);
    }
    if let Some(body) = body
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        args.push("--body".to_string());
        args.push(body);
    }

    let output = runner.run(Some(cwd), &GhCommand { args, stdin: None })?;
    if !output.status_success {
        return Err(format_gh_error(&output));
    }

    Ok(GitHubMergedPullRequest {
        sha: None,
        merged: true,
        message: "Pull request merged.".to_string(),
    })
}

pub fn repository_merge_options(
    cwd: &Path,
    repository: &GitHubRepository,
) -> Result<RepositoryMergeOptions, String> {
    repository_merge_options_with_runner(&ProcessGhRunner, cwd, repository)
}

pub(super) fn repository_merge_options_with_runner(
    runner: &impl GhRunner,
    cwd: &Path,
    repository: &GitHubRepository,
) -> Result<RepositoryMergeOptions, String> {
    let response = gh_api_get_with_runner::<GhRepositoryMergeOptions>(
        runner,
        cwd,
        &format!("repos/{}/{}", repository.owner, repository.name),
    )?;

    Ok(RepositoryMergeOptions::from_optional_provider_flags(
        response.allow_merge_commit,
        response.allow_squash_merge,
        response.allow_rebase_merge,
    ))
}

pub(super) fn submit_top_level_pull_request_review_with_runner(
    runner: &impl GhRunner,
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
    event: GitHubPullRequestReviewEvent,
    body: Option<String>,
) -> Result<GitHubSubmittedPullRequestReview, String> {
    let body = body
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if matches!(event, GitHubPullRequestReviewEvent::RequestChanges) && body.is_none() {
        return Err("A review comment is required when requesting changes.".to_string());
    }

    let event_flag = match event {
        GitHubPullRequestReviewEvent::Approve => "--approve",
        GitHubPullRequestReviewEvent::RequestChanges => "--request-changes",
        GitHubPullRequestReviewEvent::Comment => "--comment",
    };
    let state = match event {
        GitHubPullRequestReviewEvent::Approve => "APPROVED",
        GitHubPullRequestReviewEvent::RequestChanges => "CHANGES_REQUESTED",
        GitHubPullRequestReviewEvent::Comment => "COMMENTED",
    };
    let mut args = vec![
        "pr".to_string(),
        "review".to_string(),
        number.to_string(),
        "--repo".to_string(),
        format!("{}/{}", repository.owner, repository.name),
        event_flag.to_string(),
    ];
    if let Some(body) = body {
        args.push("--body".to_string());
        args.push(body);
    }

    let output = runner.run(Some(cwd), &GhCommand { args, stdin: None })?;
    if !output.status_success {
        return Err(format_gh_error(&output));
    }

    Ok(GitHubSubmittedPullRequestReview {
        id: 0,
        state: state.to_string(),
        html_url: Some(format!(
            "https://github.com/{}/{}/pull/{}",
            repository.owner, repository.name, number
        )),
    })
}

pub fn update_pull_request_comment(
    cwd: &Path,
    repository: &GitHubRepository,
    kind: GitHubPullRequestCommentKind,
    comment_id: u64,
    body: String,
) -> Result<GitHubPullRequestComment, String> {
    let body = body.trim().to_string();
    if body.is_empty() {
        return Err("Comment body is required.".to_string());
    }
    let payload = UpdateCommentPayload { body };
    let endpoint = match kind {
        GitHubPullRequestCommentKind::Conversation => {
            format!(
                "repos/{}/{}/issues/comments/{}",
                repository.owner, repository.name, comment_id
            )
        }
        GitHubPullRequestCommentKind::Review => {
            format!(
                "repos/{}/{}/pulls/comments/{}",
                repository.owner, repository.name, comment_id
            )
        }
    };

    match kind {
        GitHubPullRequestCommentKind::Conversation => {
            gh_api_json::<_, IssueCommentResponse>(cwd, "PATCH", &endpoint, &payload)
                .map(Into::into)
        }
        GitHubPullRequestCommentKind::Review => {
            gh_api_json::<_, ReviewCommentResponse>(cwd, "PATCH", &endpoint, &payload)
                .map(Into::into)
        }
    }
}

pub fn submit_pull_request_review_reply(
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
    comment_id: u64,
    body: String,
) -> Result<GitHubPullRequestComment, String> {
    let body = body.trim().to_string();
    if body.is_empty() {
        return Err("Reply body is required.".to_string());
    }
    let payload = UpdateCommentPayload { body };
    gh_api_json::<_, ReviewCommentResponse>(
        cwd,
        "POST",
        &format!(
            "repos/{}/{}/pulls/{}/comments/{}/replies",
            repository.owner, repository.name, number, comment_id
        ),
        &payload,
    )
    .map(Into::into)
}

pub fn submit_pull_request_conversation_comment(
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
    body: String,
) -> Result<GitHubPullRequestComment, String> {
    let body = body.trim().to_string();
    if body.is_empty() {
        return Err("Comment body is required.".to_string());
    }

    let payload = UpdateCommentPayload { body };
    gh_api_json::<_, IssueCommentResponse>(
        cwd,
        "POST",
        &format!(
            "repos/{}/{}/issues/{}/comments",
            repository.owner, repository.name, number
        ),
        &payload,
    )
    .map(Into::into)
}
