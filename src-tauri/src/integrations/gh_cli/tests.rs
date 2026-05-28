use super::super::{
    GitHubCliAvailability, GitHubMergeMethod, GitHubPullRequestCommentKind,
    GitHubPullRequestReviewEvent, GitHubRepository,
};
use super::api::format_gh_error;
use super::pull_requests::{
    list_open_pull_requests_with_runner, list_pull_request_comments_with_runner,
    list_pull_request_commits_with_runner, merge_pull_request_with_runner,
    repository_merge_options_with_runner, submit_top_level_pull_request_review_with_runner,
};
use super::review_threads::{
    collect_review_thread_metadata, ReviewThreadGraphQlComment,
    ReviewThreadGraphQlCommentConnection, ReviewThreadGraphQlNode,
};
use super::runner::{GhCommand, GhOutput, GhRunner};
use super::status::{detect_status_for_settings_with_runner, detect_status_with_runner};
use super::wire::ReviewThreadMetadata;
use std::cell::RefCell;
use std::path::Path;

struct MockGhRunner {
    outputs: RefCell<Vec<Result<GhOutput, String>>>,
    commands: RefCell<Vec<GhCommand>>,
}

impl MockGhRunner {
    fn new(outputs: Vec<Result<GhOutput, String>>) -> Self {
        Self {
            outputs: RefCell::new(outputs),
            commands: RefCell::new(Vec::new()),
        }
    }
}

impl GhRunner for MockGhRunner {
    fn run(&self, _cwd: Option<&Path>, command: &GhCommand) -> Result<GhOutput, String> {
        self.commands.borrow_mut().push(command.clone());
        self.outputs.borrow_mut().remove(0)
    }
}

fn ok(stdout: &str) -> Result<GhOutput, String> {
    Ok(GhOutput {
        status_success: true,
        stdout: stdout.to_string(),
        stderr: String::new(),
    })
}

fn failed(stderr: &str) -> Result<GhOutput, String> {
    Ok(GhOutput {
        status_success: false,
        stdout: String::new(),
        stderr: stderr.to_string(),
    })
}

#[test]
fn detects_missing_gh() {
    let runner = MockGhRunner::new(vec![Err("No such file or directory".to_string())]);

    let status = detect_status_with_runner(&runner);

    assert_eq!(status.availability, GitHubCliAvailability::NotInstalled);
    assert!(status.message.unwrap().contains("No such file"));
}

#[test]
fn detects_unauthenticated_gh() {
    let runner = MockGhRunner::new(vec![
        ok("gh version 2.49.2 (2024-05-13)\n"),
        failed("You are not logged into any GitHub hosts\n"),
    ]);

    let status = detect_status_with_runner(&runner);

    assert_eq!(status.availability, GitHubCliAvailability::NotAuthenticated);
    assert_eq!(status.version.as_deref(), Some("2.49.2"));
}

#[test]
fn detects_ready_gh() {
    let runner = MockGhRunner::new(vec![
        ok("gh version 2.49.2 (2024-05-13)\n"),
        ok("github.com\n  ✓ Logged in\n"),
        ok(r#"{"login":"marco","avatar_url":"https://avatar"}"#),
    ]);

    let status = detect_status_with_runner(&runner);

    assert_eq!(status.availability, GitHubCliAvailability::Ready);
    assert_eq!(status.connection.unwrap().account_login, "marco");
}

#[test]
fn settings_status_skips_identity_probe() {
    let runner = MockGhRunner::new(vec![
        ok("gh version 2.49.2 (2024-05-13)\n"),
        ok("github.com\n  ✓ Logged in\n"),
    ]);

    let status = detect_status_for_settings_with_runner(&runner);

    assert_eq!(status.availability, GitHubCliAvailability::Ready);
    assert_eq!(status.version.as_deref(), Some("2.49.2"));
    assert_eq!(status.connection, None);
    let commands = runner.commands.borrow();
    assert_eq!(commands.len(), 2);
    assert_eq!(commands[0].args, vec!["--version"]);
    assert_eq!(commands[1].args, vec!["auth", "status", "-h", "github.com"]);
}

#[test]
fn builds_pr_list_command_with_explicit_args() {
    let runner = MockGhRunner::new(vec![ok(r#"[
              {
                "number": 7,
                "title": "Update dependency",
                "state": "OPEN",
                "isDraft": false,
                "url": "https://github.com/acme/app/pull/7",
                "author": { "login": "marco", "avatar_url": null },
                "baseRefName": "main",
                "headRefName": "feature/update",
                "headRefOid": "abc123",
                "headRepository": { "nameWithOwner": "acme/app" },
                "createdAt": "2026-05-26T10:00:00Z",
                "updatedAt": "2026-05-26T11:00:00Z"
              }
            ]"#)]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    let pulls = list_open_pull_requests_with_runner(&runner, Path::new("/tmp/repo"), &repository)
        .expect("list pulls");

    assert_eq!(pulls.len(), 1);
    assert_eq!(pulls[0].number, 7);
    assert_eq!(pulls[0].base.label, "acme:main");
    assert_eq!(pulls[0].head.ref_name, "feature/update");
    assert_eq!(
        pulls[0].head.repository_full_name.as_deref(),
        Some("acme/app"),
    );
    let commands = runner.commands.borrow();
    assert_eq!(commands[0].args[0], "pr");
    assert!(commands[0].args.contains(&"--json".to_string()));
    assert!(commands[0].stdin.is_none());
}

#[test]
fn builds_pr_commit_list_command() {
    let runner = MockGhRunner::new(vec![ok(r#"{
          "commits": [
            {
              "oid": "abc123",
              "messageHeadline": "Add checkout validation",
              "messageBody": "Detailed body"
            },
            {
              "oid": "def456",
              "messageHeadline": "Update checkout copy",
              "messageBody": ""
            }
          ]
        }"#)]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    let commits =
        list_pull_request_commits_with_runner(&runner, Path::new("/tmp/repo"), &repository, 7)
            .expect("list pull request commits");

    assert_eq!(commits.len(), 2);
    assert_eq!(commits[0].sha, "abc123");
    assert_eq!(commits[0].message_headline, "Add checkout validation");
    assert_eq!(commits[0].message_body, "Detailed body");
    assert_eq!(commits[1].message, "Update checkout copy");
    assert_eq!(
        runner.commands.borrow()[0].args,
        vec!["pr", "view", "7", "--repo", "acme/app", "--json", "commits",]
    );
}

#[test]
fn formats_gh_errors_with_stderr_context() {
    let output = GhOutput {
        status_success: false,
        stdout: String::new(),
        stderr: "HTTP 403: Resource not accessible by integration".to_string(),
    };

    let message = format_gh_error(&output);

    assert!(message.contains("GitHub CLI request failed"));
    assert!(message.contains("Resource not accessible by integration"));
}

#[test]
fn top_level_review_uses_native_pr_review_command() {
    let runner = MockGhRunner::new(vec![ok("")]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    let review = submit_top_level_pull_request_review_with_runner(
        &runner,
        Path::new("/tmp/repo"),
        &repository,
        7,
        GitHubPullRequestReviewEvent::Approve,
        Some(" Looks good ".to_string()),
    )
    .expect("submit review");

    assert_eq!(review.state, "APPROVED");
    assert_eq!(
        review.html_url.as_deref(),
        Some("https://github.com/acme/app/pull/7")
    );
    assert_eq!(
        runner.commands.borrow()[0].args,
        vec![
            "pr",
            "review",
            "7",
            "--repo",
            "acme/app",
            "--approve",
            "--body",
            "Looks good",
        ]
    );
}

#[test]
fn merge_uses_native_pr_merge_command() {
    let runner = MockGhRunner::new(vec![ok("")]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    let merge = merge_pull_request_with_runner(
        &runner,
        Path::new("/tmp/repo"),
        &repository,
        7,
        GitHubMergeMethod::Merge,
        Some(" Merge PR title ".to_string()),
        Some(" Ship it ".to_string()),
    )
    .expect("merge pr");

    assert!(merge.merged);
    assert_eq!(
        runner.commands.borrow()[0].args,
        vec![
            "pr",
            "merge",
            "7",
            "--repo",
            "acme/app",
            "--merge",
            "--subject",
            "Merge PR title",
            "--body",
            "Ship it",
        ]
    );
}

#[test]
fn merge_uses_selected_native_merge_method() {
    let runner = MockGhRunner::new(vec![ok("")]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    merge_pull_request_with_runner(
        &runner,
        Path::new("/tmp/repo"),
        &repository,
        7,
        GitHubMergeMethod::Squash,
        None,
        None,
    )
    .expect("squash merge pr");

    assert_eq!(
        runner.commands.borrow()[0].args,
        vec!["pr", "merge", "7", "--repo", "acme/app", "--squash",]
    );
}

#[test]
fn repository_merge_options_use_repo_api() {
    let runner = MockGhRunner::new(vec![ok(r#"{
          "allow_merge_commit": true,
          "allow_squash_merge": false,
          "allow_rebase_merge": true
        }"#)]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    let options =
        repository_merge_options_with_runner(&runner, Path::new("/tmp/repo"), &repository)
            .expect("repo merge options");

    assert!(options.merge_commit);
    assert!(!options.squash);
    assert!(options.rebase);
    assert_eq!(
        runner.commands.borrow()[0].args,
        vec!["api", "repos/acme/app"]
    );
}

#[test]
fn repository_merge_options_fall_back_when_fields_are_missing() {
    let runner = MockGhRunner::new(vec![ok("{}")]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    let options =
        repository_merge_options_with_runner(&runner, Path::new("/tmp/repo"), &repository)
            .expect("repo merge options");

    assert!(options.merge_commit);
    assert!(options.squash);
    assert!(options.rebase);
}

#[test]
fn request_changes_requires_body_for_native_pr_review() {
    let runner = MockGhRunner::new(vec![]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    let error = submit_top_level_pull_request_review_with_runner(
        &runner,
        Path::new("/tmp/repo"),
        &repository,
        7,
        GitHubPullRequestReviewEvent::RequestChanges,
        Some(" ".to_string()),
    )
    .expect_err("request changes requires body");

    assert_eq!(
        error,
        "A review comment is required when requesting changes."
    );
    assert!(runner.commands.borrow().is_empty());
}

#[test]
fn loads_comments_when_review_thread_metadata_fails() {
    let runner = MockGhRunner::new(vec![
        ok(r#"[[{
              "id": 1,
              "user": { "login": "marco", "avatar_url": null },
              "body": "Conversation",
              "created_at": "2026-05-26T10:00:00Z",
              "updated_at": "2026-05-26T10:00:00Z"
            }]]"#),
        ok(r#"[[{
              "id": 2,
              "user": { "login": "marco", "avatar_url": null },
              "body": "Review",
              "created_at": "2026-05-26T10:00:00Z",
              "updated_at": "2026-05-26T10:00:00Z",
              "path": "package.json",
              "line": 27,
              "subject_type": "line"
            }]]"#),
        failed("GraphQL: Resource not accessible"),
    ]);
    let repository = GitHubRepository {
        owner: "acme".to_string(),
        name: "app".to_string(),
    };

    let comments =
        list_pull_request_comments_with_runner(&runner, Path::new("/tmp/repo"), &repository, 7)
            .expect("comments load without thread metadata");

    assert_eq!(comments.len(), 2);
    assert_eq!(comments[0].kind, GitHubPullRequestCommentKind::Conversation);
    assert_eq!(comments[1].kind, GitHubPullRequestCommentKind::Review);
    assert_eq!(comments[1].review_thread_id, None);
    let commands = runner.commands.borrow();
    assert_eq!(
        commands[0].args,
        vec![
            "api",
            "repos/acme/app/issues/7/comments",
            "--paginate",
            "--slurp",
        ],
    );
    assert_eq!(
        commands[1].args,
        vec![
            "api",
            "repos/acme/app/pulls/7/comments",
            "--paginate",
            "--slurp",
        ],
    );
    assert_eq!(commands[2].args, vec!["api", "graphql", "--input", "-"]);
}

#[test]
fn collects_review_thread_metadata_for_each_comment() {
    let metadata = collect_review_thread_metadata(vec![ReviewThreadGraphQlNode {
        id: "thread-1".to_string(),
        is_resolved: true,
        comments: ReviewThreadGraphQlCommentConnection {
            nodes: Some(vec![
                ReviewThreadGraphQlComment {
                    database_id: Some(10),
                },
                ReviewThreadGraphQlComment {
                    database_id: Some(11),
                },
            ]),
        },
    }]);

    assert_eq!(
        metadata.get(&10),
        Some(&ReviewThreadMetadata {
            thread_id: "thread-1".to_string(),
            resolved: true,
        }),
    );
    assert_eq!(
        metadata.get(&11),
        Some(&ReviewThreadMetadata {
            thread_id: "thread-1".to_string(),
            resolved: true,
        }),
    );
}
