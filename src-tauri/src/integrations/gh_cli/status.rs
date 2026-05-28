use super::super::{GitHubCliAvailability, GitHubCliStatus};
use super::api::non_empty_stderr;
use super::runner::{GhCommand, GhRunner, ProcessGhRunner};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

#[cfg(test)]
use super::super::ProviderConnectionSummary;
#[cfg(test)]
use super::api::run_json;
#[cfg(test)]
use super::wire::GhUserResponse;
#[cfg(test)]
use std::path::Path;

const GITHUB_HOST: &str = "github.com";
const STATUS_CACHE_TTL: Duration = Duration::from_secs(15);

struct StatusCacheEntry {
    checked_at: Instant,
    status: GitHubCliStatus,
}

static STATUS_CACHE: OnceLock<Mutex<Option<StatusCacheEntry>>> = OnceLock::new();

pub fn detect_status_cached() -> GitHubCliStatus {
    let cache = STATUS_CACHE.get_or_init(|| Mutex::new(None));

    if let Ok(guard) = cache.lock() {
        if let Some(entry) = guard.as_ref() {
            if entry.checked_at.elapsed() < STATUS_CACHE_TTL {
                return entry.status.clone();
            }
        }
    }

    let status = detect_status_for_settings_with_runner(&ProcessGhRunner);
    if let Ok(mut guard) = cache.lock() {
        *guard = Some(StatusCacheEntry {
            checked_at: Instant::now(),
            status: status.clone(),
        });
    }

    status
}

pub(super) fn detect_status_for_settings_with_runner(runner: &impl GhRunner) -> GitHubCliStatus {
    let (version, auth_status) = installed_and_authenticated_status(runner);

    if let Err(status) = auth_status {
        return status;
    }

    GitHubCliStatus {
        availability: GitHubCliAvailability::Ready,
        version,
        connection: None,
        message: None,
    }
}

#[cfg(test)]
pub(super) fn detect_status_with_runner(runner: &impl GhRunner) -> GitHubCliStatus {
    let (version, auth_status) = installed_and_authenticated_status(runner);

    if let Err(status) = auth_status {
        return status;
    }

    match verify_with_runner(runner, None) {
        Ok(connection) => GitHubCliStatus {
            availability: GitHubCliAvailability::Ready,
            version,
            connection: Some(connection),
            message: None,
        },
        Err(error) => GitHubCliStatus {
            availability: GitHubCliAvailability::NotAuthenticated,
            version,
            connection: None,
            message: Some(error),
        },
    }
}

fn installed_and_authenticated_status(
    runner: &impl GhRunner,
) -> (Option<String>, Result<(), GitHubCliStatus>) {
    let version_output = match runner.run(
        None,
        &GhCommand {
            args: vec!["--version".to_string()],
            stdin: None,
        },
    ) {
        Ok(output) if output.status_success => output,
        Ok(output) => {
            return (
                None,
                Err(GitHubCliStatus {
                    availability: GitHubCliAvailability::NotInstalled,
                    version: None,
                    connection: None,
                    message: Some(non_empty_stderr(&output).unwrap_or_else(|| {
                        "GitHub CLI is not installed or could not be started.".to_string()
                    })),
                }),
            );
        }
        Err(error) => {
            return (
                None,
                Err(GitHubCliStatus {
                    availability: GitHubCliAvailability::NotInstalled,
                    version: None,
                    connection: None,
                    message: Some(error),
                }),
            );
        }
    };
    let version = parse_version(&version_output.stdout);

    let auth_output = match runner.run(
        None,
        &GhCommand {
            args: vec![
                "auth".to_string(),
                "status".to_string(),
                "-h".to_string(),
                GITHUB_HOST.to_string(),
            ],
            stdin: None,
        },
    ) {
        Ok(output) => output,
        Err(error) => {
            return (
                version.clone(),
                Err(GitHubCliStatus {
                    availability: GitHubCliAvailability::NotAuthenticated,
                    version,
                    connection: None,
                    message: Some(error),
                }),
            );
        }
    };
    if !auth_output.status_success {
        return (
            version.clone(),
            Err(GitHubCliStatus {
                availability: GitHubCliAvailability::NotAuthenticated,
                version,
                connection: None,
                message: Some(non_empty_stderr(&auth_output).unwrap_or_else(|| {
                    "GitHub CLI is installed but is not authenticated. Run gh auth login."
                        .to_string()
                })),
            }),
        );
    }

    (version, Ok(()))
}

#[cfg(test)]
fn verify_with_runner(
    runner: &impl GhRunner,
    cwd: Option<&Path>,
) -> Result<ProviderConnectionSummary, String> {
    let user = run_json::<GhUserResponse>(
        runner,
        cwd,
        GhCommand {
            args: vec!["api".to_string(), "user".to_string()],
            stdin: None,
        },
    )?;

    Ok(ProviderConnectionSummary {
        account_login: user.login,
        avatar_url: user.avatar_url,
        scopes: Vec::new(),
    })
}

fn parse_version(stdout: &str) -> Option<String> {
    stdout
        .lines()
        .find_map(|line| line.strip_prefix("gh version "))
        .and_then(|rest| rest.split_whitespace().next())
        .map(str::to_string)
}
