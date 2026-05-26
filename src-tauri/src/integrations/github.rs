use super::{
    GitHubOAuthStartResponse, GitHubPullRequestBranch, GitHubPullRequestComment,
    GitHubPullRequestCommentKind, GitHubPullRequestListItem, GitHubPullRequestReviewCommentDraft,
    GitHubPullRequestReviewEvent, GitHubPullRequestUser, GitHubRepository,
    GitHubPullRequestReviewThreadState, GitHubSubmittedPullRequestReview,
    ProviderConnectionSummary,
};
use reqwest::header::{
    HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE, LINK, USER_AGENT,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const GITHUB_USER_ENDPOINT: &str = "https://api.github.com/user";
const GITHUB_DEVICE_CODE_ENDPOINT: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_ENDPOINT: &str = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE: &str = "https://api.github.com";
const GITHUB_GRAPHQL_ENDPOINT: &str = "https://api.github.com/graphql";
const GITHUB_OAUTH_SCOPE: &str = "repo read:user";
const GITHUB_OAUTH_CLIENT_ID_ENV: &str = "GITANO_GITHUB_OAUTH_CLIENT_ID";
const USER_AGENT_VALUE: &str = "Gitano";

#[derive(Debug, Deserialize)]
struct GitHubUserResponse {
    login: String,
    avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubApiError {
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubGraphQlError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct GitHubGraphQlResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GitHubGraphQlError>>,
}

#[derive(Debug, Deserialize)]
struct GitHubDeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct GitHubOAuthTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PullRequestUserResponse {
    login: String,
    avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PullRequestRepositoryResponse {
    full_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PullRequestBranchResponse {
    label: String,
    #[serde(rename = "ref")]
    ref_name: String,
    sha: String,
    repo: Option<PullRequestRepositoryResponse>,
}

#[derive(Debug, Deserialize)]
struct PullRequestResponse {
    number: u64,
    title: String,
    state: String,
    draft: Option<bool>,
    html_url: String,
    user: Option<PullRequestUserResponse>,
    base: PullRequestBranchResponse,
    head: PullRequestBranchResponse,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct IssueCommentResponse {
    id: u64,
    user: Option<PullRequestUserResponse>,
    body: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct ReviewCommentResponse {
    id: u64,
    user: Option<PullRequestUserResponse>,
    body: Option<String>,
    created_at: String,
    updated_at: String,
    html_url: Option<String>,
    path: Option<String>,
    side: Option<String>,
    line: Option<u64>,
    original_line: Option<u64>,
    diff_hunk: Option<String>,
    subject_type: Option<String>,
    in_reply_to_id: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ReviewThreadMetadata {
    thread_id: String,
    resolved: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewThreadGraphQlComment {
    database_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ReviewThreadGraphQlCommentConnection {
    nodes: Option<Vec<ReviewThreadGraphQlComment>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewThreadGraphQlNode {
    id: String,
    is_resolved: bool,
    comments: ReviewThreadGraphQlCommentConnection,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewThreadsGraphQlVariables<'a> {
    owner: &'a str,
    name: &'a str,
    number: i64,
    after: Option<String>,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResolveReviewThreadGraphQlVariables<'a> {
    thread_id: &'a str,
}

#[derive(Debug, Serialize)]
struct GitHubGraphQlRequest<TVariables> {
    query: &'static str,
    variables: TVariables,
}

#[derive(Debug, Serialize)]
struct SubmitReviewCommentPayload {
    path: String,
    body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    side: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    line: Option<u64>,
}

#[derive(Debug, Serialize)]
struct SubmitFileReviewCommentPayload {
    path: String,
    body: String,
    subject_type: String,
}

#[derive(Debug, Serialize)]
struct SubmitReviewPayload {
    event: GitHubPullRequestReviewEvent,
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    comments: Vec<SubmitReviewCommentPayload>,
}

#[derive(Debug, Serialize)]
struct UpdateCommentPayload {
    body: String,
}

#[derive(Debug, Deserialize)]
struct SubmittedReviewResponse {
    id: u64,
    state: String,
    html_url: Option<String>,
}

impl From<PullRequestUserResponse> for GitHubPullRequestUser {
    fn from(user: PullRequestUserResponse) -> Self {
        Self {
            login: user.login,
            avatar_url: user.avatar_url,
        }
    }
}

impl From<PullRequestBranchResponse> for GitHubPullRequestBranch {
    fn from(branch: PullRequestBranchResponse) -> Self {
        Self {
            label: branch.label,
            ref_name: branch.ref_name,
            sha: branch.sha,
            repository_full_name: branch.repo.and_then(|repo| repo.full_name),
        }
    }
}

impl From<PullRequestResponse> for GitHubPullRequestListItem {
    fn from(pr: PullRequestResponse) -> Self {
        Self {
            number: pr.number,
            title: pr.title,
            state: pr.state,
            draft: pr.draft.unwrap_or(false),
            html_url: pr.html_url,
            user: pr.user.map(Into::into),
            base: pr.base.into(),
            head: pr.head.into(),
            created_at: pr.created_at,
            updated_at: pr.updated_at,
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

impl From<GitHubDeviceCodeResponse> for GitHubOAuthStartResponse {
    fn from(response: GitHubDeviceCodeResponse) -> Self {
        Self {
            device_code: response.device_code,
            user_code: response.user_code,
            verification_uri: response.verification_uri,
            expires_in: response.expires_in,
            interval: response.interval.unwrap_or(5),
        }
    }
}

fn parse_scopes(headers: &HeaderMap) -> Vec<String> {
    headers
        .get("x-oauth-scopes")
        .and_then(|value| value.to_str().ok())
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|scope| !scope.is_empty())
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn github_oauth_scope() -> &'static str {
    GITHUB_OAUTH_SCOPE
}

fn github_oauth_client_id() -> Result<String, String> {
    std::env::var(GITHUB_OAUTH_CLIENT_ID_ENV)
        .ok()
        .or_else(|| option_env!("GITANO_GITHUB_OAUTH_CLIENT_ID").map(ToString::to_string))
        .or_else(github_oauth_client_id_from_env_file)
        .map(|client_id| client_id.trim().to_string())
        .filter(|client_id| !client_id.is_empty())
        .ok_or_else(|| {
            "GitHub OAuth is not configured. Set GITANO_GITHUB_OAUTH_CLIENT_ID before launching Gitano, or add it to .env.local for local development.".to_string()
        })
}

fn github_oauth_client_id_from_env_file() -> Option<String> {
    env_file_search_roots()
        .into_iter()
        .flat_map(|root| root.ancestors().map(Path::to_path_buf).collect::<Vec<_>>())
        .flat_map(|root| [root.join(".env.local"), root.join(".env")])
        .find_map(|path| {
            std::fs::read_to_string(path)
                .ok()
                .and_then(|contents| parse_env_file_value(&contents, GITHUB_OAUTH_CLIENT_ID_ENV))
        })
}

fn env_file_search_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(current_dir) = std::env::current_dir() {
        roots.push(current_dir);
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            roots.push(exe_dir.to_path_buf());
        }
    }
    roots
}

fn parse_env_file_value(contents: &str, key: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            return None;
        }

        let line = line.strip_prefix("export ").unwrap_or(line);
        let (name, value) = line.split_once('=')?;
        if name.trim() != key {
            return None;
        }

        let value = value.trim().trim_matches('"').trim_matches('\'').trim();
        (!value.is_empty()).then(|| value.to_string())
    })
}

fn form_encode_component(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push('+'),
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }
    encoded
}

fn form_encode(params: &[(&str, &str)]) -> String {
    params
        .iter()
        .map(|(key, value)| {
            format!(
                "{}={}",
                form_encode_component(key),
                form_encode_component(value)
            )
        })
        .collect::<Vec<_>>()
        .join("&")
}

fn oauth_error_message(error: &str, description: Option<&str>) -> String {
    match error {
        "authorization_pending" => {
            "GitHub authorization is still pending. Complete authorization in your browser."
                .to_string()
        }
        "slow_down" => {
            "GitHub authorization is still pending. GitHub asked Gitano to poll more slowly."
                .to_string()
        }
        "expired_token" => {
            "GitHub authorization expired. Start the connection flow again.".to_string()
        }
        "access_denied" => "GitHub authorization was denied.".to_string(),
        _ => description
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
            .unwrap_or_else(|| format!("GitHub authorization failed: {}", error)),
    }
}

fn github_auth_header(token: &str) -> Result<HeaderValue, String> {
    HeaderValue::from_str(&format!("Bearer {}", token))
        .map_err(|_| "GitHub token contains unsupported characters.".to_string())
}

fn github_api_url(repository: &GitHubRepository, path: &str) -> String {
    format!(
        "{}/repos/{}/{}/{}",
        GITHUB_API_BASE,
        repository.owner,
        repository.name,
        path.trim_start_matches('/'),
    )
}

fn extract_next_link(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(LINK)?.to_str().ok()?;
    raw.split(',').find_map(|entry| {
        let entry = entry.trim();
        if !entry.contains("rel=\"next\"") {
            return None;
        }
        let start = entry.find('<')?;
        let end = entry.find('>')?;
        Some(entry[start + 1..end].to_string())
    })
}

fn parse_github_error_body(body: &str) -> Option<String> {
    serde_json::from_str::<GitHubApiError>(body)
        .ok()
        .and_then(|error| error.message)
        .filter(|message| !message.trim().is_empty())
}

async fn get_json<T: DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
    token: &str,
) -> Result<(T, HeaderMap), String> {
    let response = client
        .get(url)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, github_auth_header(token)?)
        .send()
        .await
        .map_err(|error| format!("GitHub request failed: {}", error))?;

    let status = response.status();
    let headers = response.headers().clone();
    let body = response
        .text()
        .await
        .map_err(|error| format!("GitHub response could not be read: {}", error))?;

    if !status.is_success() {
        let message = parse_github_error_body(&body).unwrap_or_else(|| body.trim().to_string());
        return Err(
            format!("GitHub request failed with status {}. {}", status, message)
                .trim()
                .to_string(),
        );
    }

    serde_json::from_str::<T>(&body)
        .map(|value| (value, headers))
        .map_err(|error| format!("GitHub response could not be parsed: {}", error))
}

async fn post_json<TRequest: Serialize, TResponse: DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    payload: &TRequest,
) -> Result<TResponse, String> {
    let response = client
        .post(url)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, github_auth_header(token)?)
        .json(payload)
        .send()
        .await
        .map_err(|error| format!("GitHub request failed: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("GitHub response could not be read: {}", error))?;

    if !status.is_success() {
        let message = parse_github_error_body(&body).unwrap_or_else(|| body.trim().to_string());
        return Err(
            format!("GitHub request failed with status {}. {}", status, message)
                .trim()
                .to_string(),
        );
    }

    serde_json::from_str::<TResponse>(&body)
        .map_err(|error| format!("GitHub response could not be parsed: {}", error))
}

async fn patch_json<TRequest: Serialize, TResponse: DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    payload: &TRequest,
) -> Result<TResponse, String> {
    let response = client
        .patch(url)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, github_auth_header(token)?)
        .json(payload)
        .send()
        .await
        .map_err(|error| format!("GitHub request failed: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("GitHub response could not be read: {}", error))?;

    if !status.is_success() {
        let message = parse_github_error_body(&body).unwrap_or_else(|| body.trim().to_string());
        return Err(
            format!("GitHub request failed with status {}. {}", status, message)
                .trim()
                .to_string(),
        );
    }

    serde_json::from_str::<TResponse>(&body)
        .map_err(|error| format!("GitHub response could not be parsed: {}", error))
}

async fn post_graphql<TVariables: Serialize, TResponse: DeserializeOwned>(
    client: &reqwest::Client,
    token: &str,
    query: &'static str,
    variables: TVariables,
) -> Result<TResponse, String> {
    let payload = GitHubGraphQlRequest { query, variables };
    let response = client
        .post(GITHUB_GRAPHQL_ENDPOINT)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, github_auth_header(token)?)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("GitHub GraphQL request failed: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("GitHub GraphQL response could not be read: {}", error))?;

    if !status.is_success() {
        let message = parse_github_error_body(&body).unwrap_or_else(|| body.trim().to_string());
        return Err(
            format!("GitHub GraphQL request failed with status {}. {}", status, message)
                .trim()
                .to_string(),
        );
    }

    let response = serde_json::from_str::<GitHubGraphQlResponse<TResponse>>(&body)
        .map_err(|error| format!("GitHub GraphQL response could not be parsed: {}", error))?;

    if let Some(errors) = response.errors {
        let message = errors
            .into_iter()
            .map(|error| error.message)
            .collect::<Vec<_>>()
            .join("; ");
        return Err(format!("GitHub GraphQL request failed. {}", message));
    }

    response
        .data
        .ok_or_else(|| "GitHub GraphQL response did not include data.".to_string())
}

async fn get_all_pages<T: DeserializeOwned>(
    first_url: String,
    token: &str,
) -> Result<Vec<T>, String> {
    let client = reqwest::Client::new();
    let mut next_url = Some(first_url);
    let mut values = Vec::new();

    while let Some(url) = next_url {
        let (mut page, headers) = get_json::<Vec<T>>(&client, &url, token).await?;
        values.append(&mut page);
        next_url = extract_next_link(&headers);
    }

    Ok(values)
}

fn pull_request_comment_update_path(
    kind: &GitHubPullRequestCommentKind,
    comment_id: u64,
) -> String {
    match kind {
        GitHubPullRequestCommentKind::Conversation => {
            format!("issues/comments/{}", comment_id)
        }
        GitHubPullRequestCommentKind::Review => {
            format!("pulls/comments/{}", comment_id)
        }
    }
}

fn apply_review_thread_metadata(
    mut comments: Vec<GitHubPullRequestComment>,
    metadata: &std::collections::HashMap<u64, ReviewThreadMetadata>,
) -> Vec<GitHubPullRequestComment> {
    comments.iter_mut().for_each(|comment| {
        if !matches!(comment.kind, GitHubPullRequestCommentKind::Review) {
            return;
        }
        if let Some(thread) = metadata.get(&comment.id) {
            comment.review_thread_id = Some(thread.thread_id.clone());
            comment.review_thread_resolved = Some(thread.resolved);
        }
    });
    comments
}

fn collect_review_thread_metadata(
    threads: Vec<ReviewThreadGraphQlNode>,
) -> std::collections::HashMap<u64, ReviewThreadMetadata> {
    let mut metadata = std::collections::HashMap::new();
    for thread in threads {
        let thread_id = thread.id;
        let resolved = thread.is_resolved;
        for comment in thread.comments.nodes.unwrap_or_default() {
            if let Some(database_id) = comment.database_id {
                metadata.insert(
                    database_id,
                    ReviewThreadMetadata {
                        thread_id: thread_id.clone(),
                        resolved,
                    },
                );
            }
        }
    }
    metadata
}

fn strip_git_suffix(value: &str) -> &str {
    value.strip_suffix(".git").unwrap_or(value)
}

fn parse_github_path(path: &str) -> Option<GitHubRepository> {
    let mut parts = strip_git_suffix(path.trim_matches('/')).split('/');
    let owner = parts.next()?.trim();
    let name = parts.next()?.trim();
    if owner.is_empty() || name.is_empty() || parts.next().is_some() {
        return None;
    }

    Some(GitHubRepository {
        owner: owner.to_string(),
        name: name.to_string(),
    })
}

pub fn parse_github_remote_url(remote_url: &str) -> Option<GitHubRepository> {
    let trimmed = remote_url.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Some(path) = trimmed.strip_prefix("git@github.com:") {
        return parse_github_path(path);
    }

    let url = reqwest::Url::parse(trimmed).ok()?;
    let host = url.host_str()?.to_lowercase();
    if host != "github.com" {
        return None;
    }

    parse_github_path(url.path())
}

pub async fn start_oauth_device_flow() -> Result<GitHubOAuthStartResponse, String> {
    let client_id = github_oauth_client_id()?;
    let body = form_encode(&[
        ("client_id", client_id.as_str()),
        ("scope", github_oauth_scope()),
    ]);

    let response = reqwest::Client::new()
        .post(GITHUB_DEVICE_CODE_ENDPOINT)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(ACCEPT, "application/json")
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|error| format!("GitHub authorization could not be started: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("GitHub authorization response could not be read: {}", error))?;

    if !status.is_success() {
        let message = parse_github_error_body(&body).unwrap_or_else(|| body.trim().to_string());
        return Err(format!(
            "GitHub authorization failed with status {}. {}",
            status, message
        )
        .trim()
        .to_string());
    }

    serde_json::from_str::<GitHubDeviceCodeResponse>(&body)
        .map(Into::into)
        .map_err(|error| {
            format!(
                "GitHub authorization response could not be parsed: {}",
                error
            )
        })
}

pub async fn complete_oauth_device_flow(device_code: &str) -> Result<String, String> {
    let client_id = github_oauth_client_id()?;
    let device_code = device_code.trim();
    if device_code.is_empty() {
        return Err("GitHub OAuth device code is required.".to_string());
    }

    let body = form_encode(&[
        ("client_id", client_id.as_str()),
        ("device_code", device_code),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
    ]);

    let response = reqwest::Client::new()
        .post(GITHUB_ACCESS_TOKEN_ENDPOINT)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(ACCEPT, "application/json")
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|error| format!("GitHub authorization could not be completed: {}", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("GitHub authorization response could not be read: {}", error))?;

    if !status.is_success() {
        let message = parse_github_error_body(&body).unwrap_or_else(|| body.trim().to_string());
        return Err(format!(
            "GitHub authorization failed with status {}. {}",
            status, message
        )
        .trim()
        .to_string());
    }

    let token_response =
        serde_json::from_str::<GitHubOAuthTokenResponse>(&body).map_err(|error| {
            format!(
                "GitHub authorization response could not be parsed: {}",
                error
            )
        })?;
    if let Some(error) = token_response.error {
        return Err(oauth_error_message(
            &error,
            token_response.error_description.as_deref(),
        ));
    }

    token_response
        .access_token
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty())
        .ok_or_else(|| "GitHub authorization did not return an access token.".to_string())
}

pub async fn verify_token(token: &str) -> Result<ProviderConnectionSummary, String> {
    let response = reqwest::Client::new()
        .get(GITHUB_USER_ENDPOINT)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, github_auth_header(token)?)
        .send()
        .await
        .map_err(|error| format!("GitHub connection verification failed: {}", error))?;

    if !response.status().is_success() {
        let status = response.status();
        let details = response.text().await.unwrap_or_default();
        return Err(format!(
            "GitHub connection verification failed with status {}. {}",
            status,
            details.trim()
        )
        .trim()
        .to_string());
    }

    let scopes = parse_scopes(response.headers());
    let user = response
        .json::<GitHubUserResponse>()
        .await
        .map_err(|error| format!("GitHub user response could not be parsed: {}", error))?;

    Ok(ProviderConnectionSummary {
        account_login: user.login,
        avatar_url: user.avatar_url,
        scopes,
    })
}

pub async fn list_open_pull_requests(
    repository: &GitHubRepository,
    token: &str,
) -> Result<Vec<GitHubPullRequestListItem>, String> {
    let url = format!(
        "{}?state=open&per_page=100",
        github_api_url(repository, "pulls")
    );
    let pulls = get_all_pages::<PullRequestResponse>(url, token).await?;
    Ok(pulls.into_iter().map(Into::into).collect())
}

pub async fn count_open_pull_requests(
    repository: &GitHubRepository,
    token: &str,
) -> Result<usize, String> {
    list_open_pull_requests(repository, token)
        .await
        .map(|pulls| pulls.len())
}

async fn list_pull_request_review_thread_metadata(
    repository: &GitHubRepository,
    number: u64,
    token: &str,
) -> Result<std::collections::HashMap<u64, ReviewThreadMetadata>, String> {
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

    let client = reqwest::Client::new();
    let mut after = None;
    let mut threads = Vec::new();

    loop {
        let variables = ReviewThreadsGraphQlVariables {
            owner: &repository.owner,
            name: &repository.name,
            number: number as i64,
            after,
        };
        let data =
            post_graphql::<_, ReviewThreadsGraphQlData>(&client, token, QUERY, variables).await?;
        let connection = data
            .repository
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

pub async fn list_pull_request_comments(
    repository: &GitHubRepository,
    number: u64,
    token: &str,
) -> Result<Vec<GitHubPullRequestComment>, String> {
    let issue_url = format!(
        "{}?per_page=100",
        github_api_url(repository, &format!("issues/{}/comments", number))
    );
    let review_url = format!(
        "{}?per_page=100",
        github_api_url(repository, &format!("pulls/{}/comments", number))
    );
    let issue_comments = get_all_pages::<IssueCommentResponse>(issue_url, token).await?;
    let review_comments = get_all_pages::<ReviewCommentResponse>(review_url, token).await?;
    let review_thread_metadata =
        list_pull_request_review_thread_metadata(repository, number, token).await?;

    let comments = issue_comments
        .into_iter()
        .map(Into::into)
        .chain(review_comments.into_iter().map(Into::into))
        .collect();

    Ok(apply_review_thread_metadata(
        comments,
        &review_thread_metadata,
    ))
}

pub async fn submit_pull_request_review(
    repository: &GitHubRepository,
    number: u64,
    token: &str,
    event: GitHubPullRequestReviewEvent,
    body: Option<String>,
    comments: Vec<GitHubPullRequestReviewCommentDraft>,
) -> Result<GitHubSubmittedPullRequestReview, String> {
    let (file_comments, line_comments): (
        Vec<GitHubPullRequestReviewCommentDraft>,
        Vec<GitHubPullRequestReviewCommentDraft>,
    ) = comments
        .into_iter()
        .partition(|comment| comment.subject_type.as_deref() == Some("file"));
    let client = reqwest::Client::new();
    let mut last_file_comment: Option<ReviewCommentResponse> = None;

    for comment in file_comments {
        let payload = SubmitFileReviewCommentPayload {
            path: comment.path,
            body: comment.body,
            subject_type: "file".to_string(),
        };
        let url = github_api_url(repository, &format!("pulls/{}/comments", number));
        last_file_comment =
            Some(post_json::<_, ReviewCommentResponse>(&client, &url, token, &payload).await?);
    }

    let payload = SubmitReviewPayload {
        event,
        body: body.and_then(|value| {
            let trimmed = value.trim().to_string();
            (!trimmed.is_empty()).then_some(trimmed)
        }),
        comments: line_comments.into_iter().map(Into::into).collect(),
    };
    if payload.comments.is_empty() {
        if let Some(comment) = last_file_comment {
            return Ok(GitHubSubmittedPullRequestReview {
                id: comment.id,
                state: "COMMENTED".to_string(),
                html_url: comment.html_url,
            });
        }
    }

    let url = github_api_url(repository, &format!("pulls/{}/reviews", number));
    let review = post_json::<_, SubmittedReviewResponse>(&client, &url, token, &payload).await?;

    Ok(review.into())
}

pub async fn update_pull_request_comment(
    repository: &GitHubRepository,
    token: &str,
    kind: GitHubPullRequestCommentKind,
    comment_id: u64,
    body: String,
) -> Result<GitHubPullRequestComment, String> {
    let body = body.trim().to_string();
    if body.is_empty() {
        return Err("Comment body is required.".to_string());
    }

    let client = reqwest::Client::new();
    let url = github_api_url(
        repository,
        &pull_request_comment_update_path(&kind, comment_id),
    );
    let payload = UpdateCommentPayload { body };

    match kind {
        GitHubPullRequestCommentKind::Conversation => {
            let comment =
                patch_json::<_, IssueCommentResponse>(&client, &url, token, &payload).await?;
            Ok(comment.into())
        }
        GitHubPullRequestCommentKind::Review => {
            let comment =
                patch_json::<_, ReviewCommentResponse>(&client, &url, token, &payload).await?;
            Ok(comment.into())
        }
    }
}

pub async fn submit_pull_request_review_reply(
    repository: &GitHubRepository,
    number: u64,
    token: &str,
    comment_id: u64,
    body: String,
) -> Result<GitHubPullRequestComment, String> {
    let body = body.trim().to_string();
    if body.is_empty() {
        return Err("Reply body is required.".to_string());
    }

    let client = reqwest::Client::new();
    let url = github_api_url(
        repository,
        &format!("pulls/{}/comments/{}/replies", number, comment_id),
    );
    let payload = UpdateCommentPayload { body };
    let comment = post_json::<_, ReviewCommentResponse>(&client, &url, token, &payload).await?;

    Ok(comment.into())
}

pub async fn resolve_pull_request_review_thread(
    token: &str,
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

    let data = post_graphql::<_, ResolveReviewThreadGraphQlData>(
        &reqwest::Client::new(),
        token,
        if resolved {
            RESOLVE_MUTATION
        } else {
            UNRESOLVE_MUTATION
        },
        ResolveReviewThreadGraphQlVariables {
            thread_id: &thread_id,
        },
    )
    .await?;
    let thread = if resolved {
        data.resolve_review_thread
    } else {
        data.unresolve_review_thread
    }
    .map(|payload| payload.thread)
    .ok_or_else(|| "GitHub did not return review thread state.".to_string())?;

    Ok(GitHubPullRequestReviewThreadState {
        thread_id: thread.id,
        resolved: thread.is_resolved,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_github_scope_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-oauth-scopes",
            HeaderValue::from_static("repo, read:user, pull_requests"),
        );

        assert_eq!(
            parse_scopes(&headers),
            vec![
                "repo".to_string(),
                "read:user".to_string(),
                "pull_requests".to_string()
            ],
        );
    }

    #[test]
    fn missing_scope_header_is_empty() {
        assert!(parse_scopes(&HeaderMap::new()).is_empty());
    }

    #[test]
    fn github_oauth_scope_requests_repository_and_user_access() {
        assert_eq!(github_oauth_scope(), "repo read:user");
    }

    #[test]
    fn form_encode_uses_oauth_form_encoding() {
        assert_eq!(
            form_encode(&[
                ("client_id", "abc123"),
                ("scope", "repo read:user"),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ]),
            "client_id=abc123&scope=repo+read%3Auser&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code",
        );
    }

    #[test]
    fn parses_github_oauth_client_id_from_env_file_contents() {
        assert_eq!(
            parse_env_file_value(
                r#"
                # local development
                export GITANO_GITHUB_OAUTH_CLIENT_ID="Iv1.example"
                "#,
                GITHUB_OAUTH_CLIENT_ID_ENV,
            ),
            Some("Iv1.example".to_string()),
        );
    }

    #[test]
    fn ignores_blank_github_oauth_client_id_from_env_file_contents() {
        assert_eq!(
            parse_env_file_value(
                "GITANO_GITHUB_OAUTH_CLIENT_ID=   ",
                GITHUB_OAUTH_CLIENT_ID_ENV
            ),
            None,
        );
    }

    #[test]
    fn parses_https_github_remote_url() {
        assert_eq!(
            parse_github_remote_url("https://github.com/acme/app.git"),
            Some(GitHubRepository {
                owner: "acme".to_string(),
                name: "app".to_string(),
            }),
        );
    }

    #[test]
    fn parses_ssh_github_remote_url() {
        assert_eq!(
            parse_github_remote_url("git@github.com:acme/app.git"),
            Some(GitHubRepository {
                owner: "acme".to_string(),
                name: "app".to_string(),
            }),
        );
    }

    #[test]
    fn rejects_non_github_remote_url() {
        assert_eq!(
            parse_github_remote_url("https://gitlab.com/acme/app.git"),
            None,
        );
    }

    #[test]
    fn builds_repository_api_urls() {
        let repository = GitHubRepository {
            owner: "acme".to_string(),
            name: "app".to_string(),
        };

        assert_eq!(
            github_api_url(&repository, "pulls"),
            "https://api.github.com/repos/acme/app/pulls",
        );
    }

    #[test]
    fn builds_comment_update_paths_by_comment_kind() {
        assert_eq!(
            pull_request_comment_update_path(&GitHubPullRequestCommentKind::Conversation, 12),
            "issues/comments/12",
        );
        assert_eq!(
            pull_request_comment_update_path(&GitHubPullRequestCommentKind::Review, 34),
            "pulls/comments/34",
        );
    }

    #[test]
    fn maps_review_comments_to_graphql_thread_metadata() {
        let comments = vec![
            GitHubPullRequestComment {
                id: 10,
                kind: GitHubPullRequestCommentKind::Review,
                author: None,
                body: "First".to_string(),
                created_at: "2026-05-21T10:00:00Z".to_string(),
                updated_at: "2026-05-21T10:00:00Z".to_string(),
                path: Some("src/app.ts".to_string()),
                side: Some("RIGHT".to_string()),
                line: Some(12),
                original_line: Some(12),
                diff_hunk: Some("@@".to_string()),
                subject_type: Some("line".to_string()),
                in_reply_to_id: None,
                review_thread_id: None,
                review_thread_resolved: None,
            },
            GitHubPullRequestComment {
                id: 11,
                kind: GitHubPullRequestCommentKind::Conversation,
                author: None,
                body: "Conversation".to_string(),
                created_at: "2026-05-21T10:00:00Z".to_string(),
                updated_at: "2026-05-21T10:00:00Z".to_string(),
                path: None,
                side: None,
                line: None,
                original_line: None,
                diff_hunk: None,
                subject_type: None,
                in_reply_to_id: None,
                review_thread_id: None,
                review_thread_resolved: None,
            },
        ];
        let mut metadata = std::collections::HashMap::new();
        metadata.insert(
            10,
            ReviewThreadMetadata {
                thread_id: "PRRT_kwDOExample".to_string(),
                resolved: true,
            },
        );

        let comments = apply_review_thread_metadata(comments, &metadata);

        assert_eq!(
            comments[0].review_thread_id,
            Some("PRRT_kwDOExample".to_string()),
        );
        assert_eq!(comments[0].review_thread_resolved, Some(true));
        assert_eq!(comments[1].review_thread_id, None);
        assert_eq!(comments[1].review_thread_resolved, None);
    }
}
