use super::super::{
    GitHubPullRequestComment, GitHubPullRequestCommentKind, GitHubPullRequestReviewThreadState,
    GitHubRepository,
};
use super::api::{gh_graphql, gh_graphql_with_runner};
use super::runner::GhRunner;
use super::wire::ReviewThreadMetadata;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ReviewThreadGraphQlComment {
    pub(super) database_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub(super) struct ReviewThreadGraphQlCommentConnection {
    pub(super) nodes: Option<Vec<ReviewThreadGraphQlComment>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ReviewThreadGraphQlNode {
    pub(super) id: String,
    pub(super) is_resolved: bool,
    pub(super) comments: ReviewThreadGraphQlCommentConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphQlPageInfo {
    has_next_page: bool,
    end_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewThreadGraphQlConnection {
    nodes: Option<Vec<ReviewThreadGraphQlNode>>,
    page_info: GraphQlPageInfo,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullRequestReviewThreadsGraphQl {
    review_threads: ReviewThreadGraphQlConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryReviewThreadsGraphQl {
    pull_request: Option<PullRequestReviewThreadsGraphQl>,
}

#[derive(Debug, Deserialize)]
struct ReviewThreadsGraphQlData {
    repository: Option<RepositoryReviewThreadsGraphQl>,
}

#[derive(Debug, Deserialize)]
struct GraphQlResponse<T> {
    data: Option<T>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewThreadsGraphQlVariables<'a> {
    owner: &'a str,
    name: &'a str,
    number: i64,
    after: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResolveReviewThreadGraphQlVariables<'a> {
    thread_id: &'a str,
}

#[derive(Debug, Serialize)]
struct GraphQlRequest<TVariables> {
    query: &'static str,
    variables: TVariables,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewThreadStateGraphQl {
    id: String,
    is_resolved: bool,
}

#[derive(Debug, Deserialize)]
struct ResolveReviewThreadGraphQlPayload {
    thread: ReviewThreadStateGraphQl,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolveReviewThreadGraphQlData {
    resolve_review_thread: Option<ResolveReviewThreadGraphQlPayload>,
    unresolve_review_thread: Option<ResolveReviewThreadGraphQlPayload>,
}

pub fn resolve_pull_request_review_thread(
    cwd: &Path,
    _repository: &GitHubRepository,
    thread_id: String,
    resolved: bool,
) -> Result<GitHubPullRequestReviewThreadState, String> {
    const RESOLVE_MUTATION: &str = r#"
        mutation GitanoResolveReviewThread($threadId: ID!) {
          resolveReviewThread(input: { threadId: $threadId }) {
            thread {
              id
              isResolved
            }
          }
        }
    "#;
    const UNRESOLVE_MUTATION: &str = r#"
        mutation GitanoUnresolveReviewThread($threadId: ID!) {
          unresolveReviewThread(input: { threadId: $threadId }) {
            thread {
              id
              isResolved
            }
          }
        }
    "#;
    let thread_id = thread_id.trim().to_string();
    if thread_id.is_empty() {
        return Err("GitHub review thread id is required.".to_string());
    }
    let payload = GraphQlRequest {
        query: if resolved {
            RESOLVE_MUTATION
        } else {
            UNRESOLVE_MUTATION
        },
        variables: ResolveReviewThreadGraphQlVariables {
            thread_id: &thread_id,
        },
    };
    let response: GraphQlResponse<ResolveReviewThreadGraphQlData> = gh_graphql(cwd, &payload)?;
    let state = response
        .data
        .and_then(|data| {
            if resolved {
                data.resolve_review_thread
            } else {
                data.unresolve_review_thread
            }
        })
        .map(|payload| payload.thread)
        .ok_or_else(|| "GitHub did not return review thread state.".to_string())?;

    Ok(GitHubPullRequestReviewThreadState {
        thread_id: state.id,
        resolved: state.is_resolved,
    })
}

pub(super) fn list_pull_request_review_thread_metadata_with_runner(
    runner: &impl GhRunner,
    cwd: &Path,
    repository: &GitHubRepository,
    number: u64,
) -> Result<HashMap<u64, ReviewThreadMetadata>, String> {
    const QUERY: &str = r#"
        query GitanoPullRequestReviewThreads($owner: String!, $name: String!, $number: Int!, $after: String) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $number) {
              reviewThreads(first: 100, after: $after) {
                nodes {
                  id
                  isResolved
                  comments(first: 100) {
                    nodes {
                      databaseId
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
    "#;

    let mut after = None;
    let mut threads = Vec::new();

    loop {
        let payload = GraphQlRequest {
            query: QUERY,
            variables: ReviewThreadsGraphQlVariables {
                owner: &repository.owner,
                name: &repository.name,
                number: number as i64,
                after,
            },
        };
        let response: GraphQlResponse<ReviewThreadsGraphQlData> =
            gh_graphql_with_runner(runner, cwd, &payload)?;
        let connection = response
            .data
            .and_then(|data| data.repository)
            .and_then(|repository| repository.pull_request)
            .map(|pull_request| pull_request.review_threads)
            .ok_or_else(|| "GitHub pull request review threads were not found.".to_string())?;

        threads.extend(connection.nodes.unwrap_or_default());
        if !connection.page_info.has_next_page {
            break;
        }
        after = connection.page_info.end_cursor;
    }

    Ok(collect_review_thread_metadata(threads))
}

pub(super) fn collect_review_thread_metadata(
    threads: Vec<ReviewThreadGraphQlNode>,
) -> HashMap<u64, ReviewThreadMetadata> {
    let mut metadata = HashMap::new();

    for thread in threads {
        for comment in thread.comments.nodes.unwrap_or_default() {
            if let Some(comment_id) = comment.database_id {
                metadata.insert(
                    comment_id,
                    ReviewThreadMetadata {
                        thread_id: thread.id.clone(),
                        resolved: thread.is_resolved,
                    },
                );
            }
        }
    }

    metadata
}

pub(super) fn apply_review_thread_metadata(
    mut comments: Vec<GitHubPullRequestComment>,
    metadata: &HashMap<u64, ReviewThreadMetadata>,
) -> Vec<GitHubPullRequestComment> {
    for comment in &mut comments {
        if !matches!(comment.kind, GitHubPullRequestCommentKind::Review) {
            continue;
        }
        if let Some(thread) = metadata.get(&comment.id) {
            comment.review_thread_id = Some(thread.thread_id.clone());
            comment.review_thread_resolved = Some(thread.resolved);
        }
    }

    comments
}
