mod credentials;
mod github;
mod types;

use std::process::Command;
pub use types::*;

const GITHUB_PROVIDER_ID: &str = "github";

fn github_provider_with_status(
    status: IntegrationConnectionStatus,
    connection: Option<ProviderConnectionSummary>,
    last_error: Option<String>,
) -> ProviderIntegration {
    ProviderIntegration {
        id: GITHUB_PROVIDER_ID.to_string(),
        display_name: "GitHub".to_string(),
        capabilities: vec![
            ProviderCapability::PullRequests,
            ProviderCapability::PullRequestReviews,
        ],
        status,
        connection,
        last_error,
    }
}

fn github_disconnected(last_error: Option<String>) -> ProviderIntegration {
    github_provider_with_status(IntegrationConnectionStatus::Disconnected, None, last_error)
}

fn github_connected(connection: Option<ProviderConnectionSummary>) -> ProviderIntegration {
    github_provider_with_status(IntegrationConnectionStatus::Connected, connection, None)
}

fn github_token() -> Result<String, String> {
    credentials::read_provider_token(GITHUB_PROVIDER_ID).map_err(|_| {
        "GitHub is not connected. Connect GitHub in Settings > Integrations.".to_string()
    })
}

fn resolve_github_repository(
    request: &GitHubRepositoryRequest,
) -> Result<GitHubRepository, String> {
    let repo = git2::Repository::open(&request.path).map_err(|error| error.to_string())?;
    let remote_name = request
        .remote_name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or("origin");
    let remote = repo.find_remote(remote_name).map_err(|_| {
        format!(
            "Remote '{}' is not configured for this repository.",
            remote_name
        )
    })?;
    let remote_url = remote
        .url()
        .ok_or_else(|| format!("Remote '{}' does not have a URL.", remote_name))?;

    github::parse_github_remote_url(remote_url).ok_or_else(|| {
        format!(
            "Remote '{}' does not resolve to a GitHub repository.",
            remote_name
        )
    })
}

fn remote_name_or_origin(remote_name: Option<&str>) -> &str {
    remote_name
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or("origin")
}

fn pull_request_ref_names(
    remote_name: &str,
    number: u64,
    base_ref: &str,
) -> Result<GitHubPreparedPullRequestRefs, String> {
    let base_ref = base_ref.trim();
    if base_ref.is_empty() {
        return Err("Pull request base ref is required.".to_string());
    }

    Ok(GitHubPreparedPullRequestRefs {
        base_ref: format!("refs/remotes/{}/{}", remote_name, base_ref),
        head_ref: format!("refs/remotes/{}/pull/{}/head", remote_name, number),
    })
}

fn pull_request_fetch_refspecs(number: u64, base_ref: &str) -> Result<Vec<String>, String> {
    let base_ref = base_ref.trim();
    if base_ref.is_empty() {
        return Err("Pull request base ref is required.".to_string());
    }

    Ok(vec![
        format!("+refs/heads/{}:refs/remotes/origin/{}", base_ref, base_ref),
        format!(
            "+refs/pull/{}/head:refs/remotes/origin/pull/{}/head",
            number, number
        ),
    ])
}

#[tauri::command]
pub fn integration_list_providers() -> Result<Vec<ProviderIntegration>, String> {
    let github = match credentials::has_provider_token(GITHUB_PROVIDER_ID) {
        Ok(true) => github_connected(None),
        Ok(false) => github_disconnected(None),
        Err(error) => github_disconnected(Some(error)),
    };

    Ok(vec![github])
}

#[tauri::command]
pub async fn integration_start_github_oauth() -> Result<GitHubOAuthStartResponse, String> {
    github::start_oauth_device_flow().await
}

#[tauri::command]
pub async fn integration_complete_github_oauth(
    request: GitHubOAuthCompleteRequest,
) -> Result<ProviderIntegration, String> {
    let token = github::complete_oauth_device_flow(&request.device_code).await?;
    let connection = github::verify_token(&token).await?;
    credentials::store_provider_token(GITHUB_PROVIDER_ID, &token)?;

    Ok(github_connected(Some(connection)))
}

#[tauri::command]
pub async fn integration_verify_provider(
    provider_id: String,
) -> Result<ProviderIntegration, String> {
    let provider_id = provider_id.trim();
    if provider_id != GITHUB_PROVIDER_ID {
        return Err(format!("Unsupported integration provider: {}", provider_id));
    }

    let token = credentials::read_provider_token(provider_id)?;
    let connection = github::verify_token(&token).await?;

    Ok(github_connected(Some(connection)))
}

#[tauri::command]
pub fn integration_disconnect_provider(provider_id: String) -> Result<ProviderIntegration, String> {
    let provider_id = provider_id.trim();
    if provider_id != GITHUB_PROVIDER_ID {
        return Err(format!("Unsupported integration provider: {}", provider_id));
    }

    credentials::delete_provider_token(provider_id)?;

    Ok(github_disconnected(None))
}

#[tauri::command]
pub async fn github_pull_request_count(
    request: GitHubRepositoryRequest,
) -> Result<GitHubPullRequestCount, String> {
    let repository = resolve_github_repository(&request)?;
    let token = github_token()?;
    let count = github::count_open_pull_requests(&repository, &token).await?;

    Ok(GitHubPullRequestCount { repository, count })
}

#[tauri::command]
pub async fn github_list_pull_requests(
    request: GitHubRepositoryRequest,
) -> Result<Vec<GitHubPullRequestListItem>, String> {
    let repository = resolve_github_repository(&request)?;
    let token = github_token()?;

    github::list_open_pull_requests(&repository, &token).await
}

#[tauri::command]
pub async fn github_prepare_pull_request_refs(
    request: GitHubPreparePullRequestRefsRequest,
) -> Result<GitHubPreparedPullRequestRefs, String> {
    let remote_name = remote_name_or_origin(request.remote_name.as_deref()).to_string();
    let prepared_refs = pull_request_ref_names(&remote_name, request.number, &request.base_ref)?;
    let mut refspecs = pull_request_fetch_refspecs(request.number, &request.base_ref)?;
    if remote_name != "origin" {
        refspecs = refspecs
            .into_iter()
            .map(|refspec| {
                refspec.replace(
                    "refs/remotes/origin/",
                    &format!("refs/remotes/{}/", remote_name),
                )
            })
            .collect();
    }

    let output = Command::new("git")
        .arg("-C")
        .arg(&request.path)
        .arg("fetch")
        .arg(&remote_name)
        .args(refspecs)
        .output()
        .map_err(|error| format!("git fetch failed: {}", error))?;

    if !output.status.success() {
        return Err(format!(
            "GitHub pull request refs could not be fetched: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(prepared_refs)
}

#[tauri::command]
pub async fn github_list_pull_request_comments(
    request: GitHubPullRequestNumberRequest,
) -> Result<Vec<GitHubPullRequestComment>, String> {
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let token = github_token()?;

    github::list_pull_request_comments(&repository, request.number, &token).await
}

#[tauri::command]
pub async fn github_submit_pull_request_review(
    request: GitHubSubmitPullRequestReviewRequest,
) -> Result<GitHubSubmittedPullRequestReview, String> {
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let token = github_token()?;

    github::submit_pull_request_review(
        &repository,
        request.number,
        &token,
        request.event,
        request.body,
        request.comments,
    )
    .await
}

#[tauri::command]
pub async fn github_update_pull_request_comment(
    request: GitHubUpdatePullRequestCommentRequest,
) -> Result<GitHubPullRequestComment, String> {
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let token = github_token()?;

    github::update_pull_request_comment(
        &repository,
        &token,
        request.kind,
        request.comment_id,
        request.body,
    )
    .await
}

#[tauri::command]
pub async fn github_submit_pull_request_review_reply(
    request: GitHubSubmitPullRequestReviewReplyRequest,
) -> Result<GitHubPullRequestComment, String> {
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let token = github_token()?;

    github::submit_pull_request_review_reply(
        &repository,
        request.number,
        &token,
        request.comment_id,
        request.body,
    )
    .await
}

#[tauri::command]
pub async fn github_resolve_pull_request_review_thread(
    request: GitHubResolvePullRequestReviewThreadRequest,
) -> Result<GitHubPullRequestReviewThreadState, String> {
    let _repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let token = github_token()?;

    github::resolve_pull_request_review_thread(&token, request.thread_id, request.resolved).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn github_catalog_entry_is_extensible_provider_summary() {
        let provider = github_disconnected(None);

        assert_eq!(provider.id, "github");
        assert_eq!(provider.display_name, "GitHub");
        assert_eq!(provider.status, IntegrationConnectionStatus::Disconnected);
        assert!(provider
            .capabilities
            .contains(&ProviderCapability::PullRequests));
        assert!(provider
            .capabilities
            .contains(&ProviderCapability::PullRequestReviews));
    }

    #[test]
    fn resolves_github_repository_from_origin_remote() {
        let temp = tempfile::tempdir().expect("temp dir");
        let repo = git2::Repository::init(temp.path()).expect("init repo");
        repo.remote("origin", "git@github.com:acme/app.git")
            .expect("add remote");

        let repository = resolve_github_repository(&GitHubRepositoryRequest {
            path: temp.path().to_string_lossy().to_string(),
            remote_name: None,
        })
        .expect("resolve repository");

        assert_eq!(
            repository,
            GitHubRepository {
                owner: "acme".to_string(),
                name: "app".to_string(),
            },
        );
    }

    #[test]
    fn builds_pull_request_refs_for_remote() {
        assert_eq!(
            pull_request_ref_names("origin", 42, "main").expect("refs"),
            GitHubPreparedPullRequestRefs {
                base_ref: "refs/remotes/origin/main".to_string(),
                head_ref: "refs/remotes/origin/pull/42/head".to_string(),
            },
        );
    }

    #[test]
    fn builds_pull_request_fetch_refspecs() {
        assert_eq!(
            pull_request_fetch_refspecs(42, "main").expect("refspecs"),
            vec![
                "+refs/heads/main:refs/remotes/origin/main".to_string(),
                "+refs/pull/42/head:refs/remotes/origin/pull/42/head".to_string(),
            ],
        );
    }
}
