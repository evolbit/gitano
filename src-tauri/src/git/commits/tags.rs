use crate::git::types::TagCommitOption;
use git2::{ObjectType, Oid, Repository, Signature};
use std::process::Command;
use tauri::command;

#[command]
pub fn search_tag_commits(
    path: String,
    query: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<TagCommitOption>, String> {
    let query = query.unwrap_or_default().trim().to_lowercase();
    let safe_limit = limit.unwrap_or(50).clamp(1, 100);
    let max_scan = if query.is_empty() {
        safe_limit
    } else {
        (safe_limit * 40).clamp(200, 2_000)
    };
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let head_commit = repo
        .head()
        .ok()
        .and_then(|head| head.target())
        .and_then(|oid| repo.find_commit(oid).ok())
        .map(|commit| commit_to_tag_option(&commit));

    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("log")
        .arg("--all")
        .arg("--date-order")
        .arg("--color=never")
        .arg("--no-abbrev-commit")
        .arg(format!("--max-count={max_scan}"))
        .arg("--pretty=format:%H%x1f%at%x1f%an%x1f%s")
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Failed to search commits".to_string()
        } else {
            stderr
        });
    }

    let mut commits = Vec::new();
    if let Some(commit) = head_commit {
        if matches_tag_commit_query(&commit, &query) {
            commits.push(commit);
        }
    }

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if commits.len() >= safe_limit {
            break;
        }

        let Some(commit) = parse_tag_commit_option(line) else {
            continue;
        };

        if commits.iter().any(|existing| existing.sha == commit.sha) {
            continue;
        }

        if matches_tag_commit_query(&commit, &query) {
            commits.push(commit);
        }
    }

    Ok(commits)
}

fn matches_tag_commit_query(commit: &TagCommitOption, query: &str) -> bool {
    query.is_empty()
        || commit.sha.to_lowercase().contains(query)
        || commit.message.to_lowercase().contains(query)
        || commit.author.to_lowercase().contains(query)
}

fn commit_to_tag_option(commit: &git2::Commit<'_>) -> TagCommitOption {
    let sha = commit.id().to_string();
    let short_sha = sha.chars().take(7).collect();
    let author = commit.author().name().unwrap_or("").to_string();
    let message = commit.summary().unwrap_or("").to_string();
    let date = commit.time().seconds();

    TagCommitOption {
        sha,
        short_sha,
        message,
        author,
        date,
    }
}

#[command]
pub fn create_tag(
    path: String,
    tag_name: String,
    commit_sha: String,
    annotated: bool,
    description: Option<String>,
) -> Result<(), String> {
    let tag_name = tag_name.trim();
    if tag_name.is_empty() {
        return Err("Tag name is required".to_string());
    }

    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let oid = Oid::from_str(commit_sha.trim()).map_err(|e| e.to_string())?;
    let target = repo
        .find_object(oid, Some(ObjectType::Commit))
        .map_err(|e| e.to_string())?;

    if annotated {
        let signature = repo
            .signature()
            .or_else(|_| Signature::now("Gitano", "gitano@example.invalid"))
            .map_err(|e| e.to_string())?;
        let message = description.unwrap_or_default();
        repo.tag(tag_name, &target, &signature, &message, false)
            .map_err(|e| e.to_string())?;
    } else {
        repo.tag_lightweight(tag_name, &target, false)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn parse_tag_commit_option(raw_line: &str) -> Option<TagCommitOption> {
    let mut fields = raw_line.trim_end_matches('\r').splitn(4, '\u{001f}');
    let sha = fields.next()?.trim().to_string();
    if sha.is_empty() {
        return None;
    }

    let date = fields
        .next()
        .unwrap_or("0")
        .trim()
        .parse::<i64>()
        .unwrap_or(0);
    let author = fields.next().unwrap_or("").to_string();
    let message = fields.next().unwrap_or("").to_string();
    let short_sha = sha.chars().take(7).collect();

    Some(TagCommitOption {
        sha,
        short_sha,
        message,
        author,
        date,
    })
}
