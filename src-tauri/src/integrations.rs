mod credentials;
mod gh_cli;
mod github;
mod preferences;
mod types;

use std::path::PathBuf;
use std::process::Command;
pub use types::*;

const GITHUB_PROVIDER_ID: &str = "github";

fn github_provider_with_status(
    status: IntegrationConnectionStatus,
    connection: Option<ProviderConnectionSummary>,
    last_error: Option<String>,
    selected_access_method: GitHubAccessMethod,
    oauth: GitHubOAuthStatus,
    gh_cli: GitHubCliStatus,
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
        selected_access_method: Some(selected_access_method),
        oauth: Some(oauth),
        gh_cli: Some(gh_cli),
    }
}

fn oauth_status_from_credentials() -> GitHubOAuthStatus {
    match credentials::has_provider_token(GITHUB_PROVIDER_ID) {
        Ok(true) => GitHubOAuthStatus {
            status: IntegrationConnectionStatus::Connected,
            connection: None,
            last_error: None,
        },
        Ok(false) => GitHubOAuthStatus {
            status: IntegrationConnectionStatus::Disconnected,
            connection: None,
            last_error: None,
        },
        Err(error) => GitHubOAuthStatus {
            status: IntegrationConnectionStatus::Disconnected,
            connection: None,
            last_error: Some(error),
        },
    }
}

fn github_provider_summary(
    selected_access_method: GitHubAccessMethod,
    oauth: GitHubOAuthStatus,
    gh_cli: GitHubCliStatus,
    last_error: Option<String>,
) -> ProviderIntegration {
    let selected_connection = match selected_access_method {
        GitHubAccessMethod::OAuth => oauth.connection.clone(),
        GitHubAccessMethod::GhCli => gh_cli.connection.clone(),
        GitHubAccessMethod::AutoFallback => oauth
            .connection
            .clone()
            .or_else(|| gh_cli.connection.clone()),
    };
    let selected_ready = match selected_access_method {
        GitHubAccessMethod::OAuth => oauth.status == IntegrationConnectionStatus::Connected,
        GitHubAccessMethod::GhCli => gh_cli.availability == GitHubCliAvailability::Ready,
        GitHubAccessMethod::AutoFallback => {
            oauth.status == IntegrationConnectionStatus::Connected
                || gh_cli.availability == GitHubCliAvailability::Ready
        }
    };

    github_provider_with_status(
        if selected_ready {
            IntegrationConnectionStatus::Connected
        } else {
            IntegrationConnectionStatus::Disconnected
        },
        selected_connection,
        last_error,
        selected_access_method,
        oauth,
        gh_cli,
    )
}

fn github_provider_from_current_state(last_error: Option<String>) -> ProviderIntegration {
    let selected_access_method = preferences::load_preferences().github_access_method;
    let oauth = oauth_status_from_credentials();
    let gh_cli = gh_cli::detect_status_cached();

    github_provider_summary(selected_access_method, oauth, gh_cli, last_error)
}

fn github_connected_with_oauth(
    connection: Option<ProviderConnectionSummary>,
) -> ProviderIntegration {
    let selected_access_method = preferences::load_preferences().github_access_method;
    let oauth = GitHubOAuthStatus {
        status: IntegrationConnectionStatus::Connected,
        connection: connection.clone(),
        last_error: None,
    };
    let gh_cli = gh_cli::detect_status_cached();

    github_provider_summary(selected_access_method, oauth, gh_cli, None)
}

fn github_token() -> Result<String, String> {
    credentials::read_provider_token(GITHUB_PROVIDER_ID).map_err(|_| {
        "GitHub is not connected. Connect GitHub in Settings > Integrations.".to_string()
    })
}

enum GitHubPrClient {
    OAuth(String),
    GhCli { cwd: PathBuf },
}

impl GitHubPrClient {
    async fn list_open_pull_requests(
        &self,
        repository: &GitHubRepository,
    ) -> Result<Vec<GitHubPullRequestListItem>, String> {
        match self {
            Self::OAuth(token) => github::list_open_pull_requests(repository, token).await,
            Self::GhCli { cwd } => gh_cli::list_open_pull_requests(cwd, repository),
        }
    }

    async fn count_open_pull_requests(
        &self,
        repository: &GitHubRepository,
    ) -> Result<usize, String> {
        match self {
            Self::OAuth(token) => github::count_open_pull_requests(repository, token).await,
            Self::GhCli { cwd } => gh_cli::count_open_pull_requests(cwd, repository),
        }
    }

    async fn list_pull_request_commits(
        &self,
        repository: &GitHubRepository,
        number: u64,
    ) -> Result<Vec<GitHubPullRequestCommit>, String> {
        match self {
            Self::OAuth(token) => {
                github::list_pull_request_commits(repository, number, token).await
            }
            Self::GhCli { cwd } => gh_cli::list_pull_request_commits(cwd, repository, number),
        }
    }

    async fn list_pull_request_comments(
        &self,
        repository: &GitHubRepository,
        number: u64,
    ) -> Result<Vec<GitHubPullRequestComment>, String> {
        match self {
            Self::OAuth(token) => {
                github::list_pull_request_comments(repository, number, token).await
            }
            Self::GhCli { cwd } => gh_cli::list_pull_request_comments(cwd, repository, number),
        }
    }

    async fn submit_pull_request_review(
        &self,
        repository: &GitHubRepository,
        number: u64,
        event: GitHubPullRequestReviewEvent,
        body: Option<String>,
        comments: Vec<GitHubPullRequestReviewCommentDraft>,
    ) -> Result<GitHubSubmittedPullRequestReview, String> {
        match self {
            Self::OAuth(token) => {
                github::submit_pull_request_review(repository, number, token, event, body, comments)
                    .await
            }
            Self::GhCli { cwd } => {
                gh_cli::submit_pull_request_review(cwd, repository, number, event, body, comments)
            }
        }
    }

    async fn submit_pull_request_conversation_comment(
        &self,
        repository: &GitHubRepository,
        number: u64,
        body: String,
    ) -> Result<GitHubPullRequestComment, String> {
        match self {
            Self::OAuth(token) => {
                github::submit_pull_request_conversation_comment(repository, number, token, body)
                    .await
            }
            Self::GhCli { cwd } => {
                gh_cli::submit_pull_request_conversation_comment(cwd, repository, number, body)
            }
        }
    }

    async fn merge_pull_request(
        &self,
        repository: &GitHubRepository,
        number: u64,
        merge_method: GitHubMergeMethod,
        title: Option<String>,
        body: Option<String>,
    ) -> Result<GitHubMergedPullRequest, String> {
        match self {
            Self::OAuth(token) => {
                github::merge_pull_request(repository, number, token, merge_method, title, body)
                    .await
            }
            Self::GhCli { cwd } => {
                gh_cli::merge_pull_request(cwd, repository, number, merge_method, title, body)
            }
        }
    }

    async fn repository_merge_options(
        &self,
        repository: &GitHubRepository,
    ) -> Result<GitHubRepositoryMergeOptions, String> {
        match self {
            Self::OAuth(token) => github::repository_merge_options(repository, token).await,
            Self::GhCli { cwd } => gh_cli::repository_merge_options(cwd, repository),
        }
    }

    async fn update_pull_request_comment(
        &self,
        repository: &GitHubRepository,
        kind: GitHubPullRequestCommentKind,
        comment_id: u64,
        body: String,
    ) -> Result<GitHubPullRequestComment, String> {
        match self {
            Self::OAuth(token) => {
                github::update_pull_request_comment(repository, token, kind, comment_id, body).await
            }
            Self::GhCli { cwd } => {
                gh_cli::update_pull_request_comment(cwd, repository, kind, comment_id, body)
            }
        }
    }

    async fn submit_pull_request_review_reply(
        &self,
        repository: &GitHubRepository,
        number: u64,
        comment_id: u64,
        body: String,
    ) -> Result<GitHubPullRequestComment, String> {
        match self {
            Self::OAuth(token) => {
                github::submit_pull_request_review_reply(
                    repository, number, token, comment_id, body,
                )
                .await
            }
            Self::GhCli { cwd } => {
                gh_cli::submit_pull_request_review_reply(cwd, repository, number, comment_id, body)
            }
        }
    }

    async fn resolve_pull_request_review_thread(
        &self,
        repository: &GitHubRepository,
        thread_id: String,
        resolved: bool,
    ) -> Result<GitHubPullRequestReviewThreadState, String> {
        match self {
            Self::OAuth(token) => {
                github::resolve_pull_request_review_thread(token, thread_id, resolved).await
            }
            Self::GhCli { cwd } => {
                gh_cli::resolve_pull_request_review_thread(cwd, repository, thread_id, resolved)
            }
        }
    }
}

fn gh_cli_client(path: &str) -> Result<GitHubPrClient, String> {
    Ok(GitHubPrClient::GhCli {
        cwd: PathBuf::from(path),
    })
}

fn oauth_client() -> Result<GitHubPrClient, String> {
    github_token().map(GitHubPrClient::OAuth)
}

fn selected_access_method() -> GitHubAccessMethod {
    preferences::load_preferences().github_access_method
}

fn is_oauth_access_policy_error(error: &str) -> bool {
    let lower = error.to_ascii_lowercase();
    lower.contains("resource not accessible by integration")
        || lower.contains("organization")
            && (lower.contains("policy") || lower.contains("third-party"))
        || lower.contains("oauth app access restrictions")
}

async fn route_github_operation<T, Fut, F>(path: &str, operation: F) -> Result<T, String>
where
    F: Fn(GitHubPrClient) -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    match selected_access_method() {
        GitHubAccessMethod::OAuth => operation(oauth_client()?).await,
        GitHubAccessMethod::GhCli => operation(gh_cli_client(path)?).await,
        GitHubAccessMethod::AutoFallback => match oauth_client() {
            Ok(client) => match operation(client).await {
                Ok(value) => Ok(value),
                Err(error) if is_oauth_access_policy_error(&error) => {
                    operation(gh_cli_client(path)?).await
                }
                Err(error) => Err(error),
            },
            Err(_) => operation(gh_cli_client(path)?).await,
        },
    }
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
    Ok(vec![github_provider_from_current_state(None)])
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

    Ok(github_connected_with_oauth(Some(connection)))
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

    Ok(github_connected_with_oauth(Some(connection)))
}

#[tauri::command]
pub fn integration_disconnect_provider(provider_id: String) -> Result<ProviderIntegration, String> {
    let provider_id = provider_id.trim();
    if provider_id != GITHUB_PROVIDER_ID {
        return Err(format!("Unsupported integration provider: {}", provider_id));
    }

    credentials::delete_provider_token(provider_id)?;

    Ok(github_provider_from_current_state(None))
}

#[tauri::command]
pub fn integration_set_github_access_method(
    request: GitHubSetAccessMethodRequest,
) -> Result<ProviderIntegration, String> {
    preferences::set_github_access_method(request.access_method)?;
    Ok(github_provider_from_current_state(None))
}

#[tauri::command]
pub async fn github_pull_request_count(
    request: GitHubRepositoryRequest,
) -> Result<GitHubPullRequestCount, String> {
    let repository = resolve_github_repository(&request)?;
    let path = request.path.clone();
    let route_repository = repository.clone();
    let count = route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        async move { client.count_open_pull_requests(&repository).await }
    })
    .await?;

    Ok(GitHubPullRequestCount { repository, count })
}

#[tauri::command]
pub async fn github_list_pull_requests(
    request: GitHubRepositoryRequest,
) -> Result<Vec<GitHubPullRequestListItem>, String> {
    let repository = resolve_github_repository(&request)?;
    let path = request.path.clone();
    let route_repository = repository.clone();

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        async move { client.list_open_pull_requests(&repository).await }
    })
    .await
}

#[tauri::command]
pub async fn github_list_pull_request_commits(
    request: GitHubPullRequestNumberRequest,
) -> Result<Vec<GitHubPullRequestCommit>, String> {
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();
    let number = request.number;

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        async move { client.list_pull_request_commits(&repository, number).await }
    })
    .await
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
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();
    let number = request.number;

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        async move { client.list_pull_request_comments(&repository, number).await }
    })
    .await
}

#[tauri::command]
pub async fn github_submit_pull_request_review(
    request: GitHubSubmitPullRequestReviewRequest,
) -> Result<GitHubSubmittedPullRequestReview, String> {
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();
    let number = request.number;
    let event = request.event;
    let body = request.body;
    let comments = request.comments;

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        let event = event.clone();
        let body = body.clone();
        let comments = comments.clone();
        async move {
            client
                .submit_pull_request_review(&repository, number, event, body, comments)
                .await
        }
    })
    .await
}

#[tauri::command]
pub async fn github_submit_pull_request_conversation_comment(
    request: GitHubSubmitPullRequestConversationCommentRequest,
) -> Result<GitHubPullRequestComment, String> {
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();
    let number = request.number;
    let body = request.body;

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        let body = body.clone();
        async move {
            client
                .submit_pull_request_conversation_comment(&repository, number, body)
                .await
        }
    })
    .await
}

#[tauri::command]
pub async fn github_merge_pull_request(
    request: GitHubMergePullRequestRequest,
) -> Result<GitHubMergedPullRequest, String> {
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();
    let number = request.number;
    let merge_method = request.merge_method;
    let title = request.title;
    let body = request.body;

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        let merge_method = merge_method.clone();
        let title = title.clone();
        let body = body.clone();
        async move {
            client
                .merge_pull_request(&repository, number, merge_method, title, body)
                .await
        }
    })
    .await
}

#[tauri::command]
pub async fn github_repository_merge_options(
    request: GitHubRepositoryMergeOptionsRequest,
) -> Result<GitHubRepositoryMergeOptions, String> {
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        async move { client.repository_merge_options(&repository).await }
    })
    .await
}

#[tauri::command]
pub async fn github_update_pull_request_comment(
    request: GitHubUpdatePullRequestCommentRequest,
) -> Result<GitHubPullRequestComment, String> {
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();
    let kind = request.kind;
    let comment_id = request.comment_id;
    let body = request.body;

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        let kind = kind.clone();
        let body = body.clone();
        async move {
            client
                .update_pull_request_comment(&repository, kind, comment_id, body)
                .await
        }
    })
    .await
}

#[tauri::command]
pub async fn github_submit_pull_request_review_reply(
    request: GitHubSubmitPullRequestReviewReplyRequest,
) -> Result<GitHubPullRequestComment, String> {
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();
    let number = request.number;
    let comment_id = request.comment_id;
    let body = request.body;

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        let body = body.clone();
        async move {
            client
                .submit_pull_request_review_reply(&repository, number, comment_id, body)
                .await
        }
    })
    .await
}

#[tauri::command]
pub async fn github_resolve_pull_request_review_thread(
    request: GitHubResolvePullRequestReviewThreadRequest,
) -> Result<GitHubPullRequestReviewThreadState, String> {
    let path = request.path.clone();
    let repository = resolve_github_repository(&GitHubRepositoryRequest {
        path: request.path,
        remote_name: request.remote_name,
    })?;
    let route_repository = repository.clone();
    let thread_id = request.thread_id;
    let resolved = request.resolved;

    route_github_operation(&path, move |client| {
        let repository = route_repository.clone();
        let thread_id = thread_id.clone();
        async move {
            client
                .resolve_pull_request_review_thread(&repository, thread_id, resolved)
                .await
        }
    })
    .await
}

#[tauri::command]
pub async fn provider_pull_request_count(
    request: ProviderRepositoryRequest,
) -> Result<GitHubPullRequestCount, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_pull_request_count(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_list_pull_requests(
    request: ProviderRepositoryRequest,
) -> Result<Vec<GitHubPullRequestListItem>, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_list_pull_requests(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_prepare_pull_request_refs(
    request: ProviderPreparePullRequestRefsRequest,
) -> Result<GitHubPreparedPullRequestRefs, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_prepare_pull_request_refs(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_list_pull_request_commits(
    request: ProviderPullRequestNumberRequest,
) -> Result<Vec<GitHubPullRequestCommit>, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_list_pull_request_commits(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_list_pull_request_comments(
    request: ProviderPullRequestNumberRequest,
) -> Result<Vec<GitHubPullRequestComment>, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_list_pull_request_comments(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_submit_pull_request_review(
    request: ProviderSubmitPullRequestReviewRequest,
) -> Result<GitHubSubmittedPullRequestReview, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_submit_pull_request_review(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_submit_pull_request_conversation_comment(
    request: ProviderSubmitPullRequestConversationCommentRequest,
) -> Result<GitHubPullRequestComment, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => {
            github_submit_pull_request_conversation_comment(request.into()).await
        }
    }
}

#[tauri::command]
pub async fn provider_repository_merge_options(
    request: ProviderRepositoryMergeOptionsRequest,
) -> Result<GitHubRepositoryMergeOptions, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_repository_merge_options(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_merge_pull_request(
    request: ProviderMergePullRequestRequest,
) -> Result<GitHubMergedPullRequest, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_merge_pull_request(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_update_pull_request_comment(
    request: ProviderUpdatePullRequestCommentRequest,
) -> Result<GitHubPullRequestComment, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => github_update_pull_request_comment(request.into()).await,
    }
}

#[tauri::command]
pub async fn provider_submit_pull_request_review_reply(
    request: ProviderSubmitPullRequestReviewReplyRequest,
) -> Result<GitHubPullRequestComment, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => {
            github_submit_pull_request_review_reply(request.into()).await
        }
    }
}

#[tauri::command]
pub async fn provider_resolve_pull_request_review_thread(
    request: ProviderResolvePullRequestReviewThreadRequest,
) -> Result<GitHubPullRequestReviewThreadState, String> {
    match request.provider_id {
        PullRequestProviderId::GitHub => {
            github_resolve_pull_request_review_thread(request.into()).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn github_catalog_entry_is_extensible_provider_summary() {
        let provider = github_provider_summary(
            GitHubAccessMethod::AutoFallback,
            GitHubOAuthStatus {
                status: IntegrationConnectionStatus::Disconnected,
                connection: None,
                last_error: None,
            },
            GitHubCliStatus {
                availability: GitHubCliAvailability::NotInstalled,
                version: None,
                connection: None,
                message: None,
            },
            None,
        );

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
    fn github_oauth_access_method_uses_frontend_wire_name() {
        assert_eq!(
            serde_json::to_value(GitHubAccessMethod::OAuth).expect("serialize access method"),
            serde_json::json!("oauth"),
        );
        assert_eq!(
            serde_json::from_value::<GitHubAccessMethod>(serde_json::json!("oauth"))
                .expect("deserialize oauth"),
            GitHubAccessMethod::OAuth,
        );
        assert_eq!(
            serde_json::from_value::<GitHubAccessMethod>(serde_json::json!("oAuth"))
                .expect("deserialize legacy oAuth"),
            GitHubAccessMethod::OAuth,
        );
    }

    #[test]
    fn repository_merge_options_default_when_provider_omits_flags() {
        assert_eq!(
            GitHubRepositoryMergeOptions::from_optional_provider_flags(None, None, None),
            GitHubRepositoryMergeOptions {
                merge_commit: true,
                squash: true,
                rebase: true,
            },
        );
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
