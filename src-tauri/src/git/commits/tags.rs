use crate::git::repository_state::repository_has_commits;
use crate::git::types::{
    GitTagRef, GitTagRefsResponse, TagCommitOption, TagNameAvailability, TagRefStatus,
};
use git2::{ObjectType, Oid, Repository, Signature};
use std::collections::{BTreeMap, BTreeSet};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

#[derive(Debug, Clone, PartialEq, Eq)]
struct LocalTagInfo {
    object_id: String,
    target_id: String,
    is_annotated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct OriginTagInfo {
    object_id: String,
    peeled_target_id: Option<String>,
}

#[command]
pub async fn get_tag_refs(path: String) -> Result<GitTagRefsResponse, String> {
    tauri::async_runtime::spawn_blocking(move || load_tag_refs(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_local_tag_refs(path: String) -> Result<Vec<GitTagRef>, String> {
    tauri::async_runtime::spawn_blocking(move || load_local_git_tag_refs(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_origin_tag_refs(path: String) -> Result<Vec<GitTagRef>, String> {
    tauri::async_runtime::spawn_blocking(move || load_origin_git_tag_refs(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn check_tag_name_availability(
    path: String,
    tag_name: String,
) -> Result<TagNameAvailability, String> {
    tauri::async_runtime::spawn_blocking(move || {
        check_tag_name_availability_inner(&path, &tag_name)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn push_tag(path: String, tag_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let tag_name = validate_tag_name(&tag_name)?;
        validate_tag_name_format(tag_name)?;
        ensure_local_tag_exists(&path, tag_name)?;
        let refspec = format!("refs/tags/{tag_name}:refs/tags/{tag_name}");
        run_git_status(&path, &["push", "origin", &refspec], "git push tag")
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn rename_tag(
    path: String,
    old_tag_name: String,
    new_tag_name: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let old_tag_name = validate_tag_name(&old_tag_name)?;
        let new_tag_name = validate_tag_name(&new_tag_name)?;
        validate_tag_name_format(new_tag_name)?;

        let repo = Repository::open(&path).map_err(|e| e.to_string())?;
        let old_info = find_local_tag_info(&repo, old_tag_name)?
            .ok_or_else(|| format!("Local tag does not exist: {old_tag_name}"))?;

        if find_local_tag_info(&repo, new_tag_name)?.is_some() {
            return Err(format!("Local tag already exists: {new_tag_name}"));
        }

        if origin_tag_exists(&path, new_tag_name).unwrap_or(false) {
            return Err(format!("Origin tag already exists: {new_tag_name}"));
        }

        rename_local_tag(&repo, old_tag_name, new_tag_name, &old_info.object_id)?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn delete_tag(
    path: String,
    tag_name: String,
    delete_local: bool,
    delete_origin: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let tag_name = validate_tag_name(&tag_name)?;
        validate_tag_name_format(tag_name)?;

        if !delete_local && !delete_origin {
            return Err("Choose at least one tag location to delete.".to_string());
        }

        if delete_origin {
            let refspec = format!(":refs/tags/{tag_name}");
            run_git_status(&path, &["push", "origin", &refspec], "git push delete tag")?;
        }

        if delete_local {
            let repo = Repository::open(&path).map_err(|e| e.to_string())?;
            delete_local_tag(&repo, tag_name)?;
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub fn search_tag_commits(
    path: String,
    query: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<TagCommitOption>, String> {
    if !repository_has_commits(&path)? {
        return Ok(Vec::new());
    }

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

fn load_tag_refs(path: &str) -> Result<GitTagRefsResponse, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let local_tags = load_local_tag_refs(&repo)?;
    let origin_tags = load_origin_tag_refs(path);
    Ok(merge_tag_refs(local_tags, origin_tags))
}

fn load_local_git_tag_refs(path: &str) -> Result<Vec<GitTagRef>, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let local_tags = load_local_tag_refs(&repo)?;
    Ok(local_tags
        .into_iter()
        .map(|(name, tag)| local_tag_ref(name, tag, TagRefStatus::Local))
        .collect())
}

fn load_origin_git_tag_refs(path: &str) -> Result<Vec<GitTagRef>, String> {
    Ok(load_origin_tag_refs(path)?
        .into_iter()
        .map(|(name, tag)| origin_tag_ref(name, tag))
        .collect())
}

fn load_local_tag_refs(repo: &Repository) -> Result<BTreeMap<String, LocalTagInfo>, String> {
    let tag_names = repo.tag_names(None).map_err(|e| e.to_string())?;
    let mut tags = BTreeMap::new();

    for tag_name in tag_names.iter().flatten() {
        tags.insert(tag_name.to_string(), read_local_tag_info(repo, tag_name)?);
    }

    Ok(tags)
}

fn find_local_tag_info(repo: &Repository, tag_name: &str) -> Result<Option<LocalTagInfo>, String> {
    if !local_tag_exists_exact(repo, tag_name)? {
        return Ok(None);
    }

    read_local_tag_info(repo, tag_name).map(Some)
}

fn local_tag_exists_exact(repo: &Repository, tag_name: &str) -> Result<bool, String> {
    let tag_names = repo.tag_names(None).map_err(|e| e.to_string())?;
    Ok(tag_names.iter().flatten().any(|name| name == tag_name))
}

fn read_local_tag_info(repo: &Repository, tag_name: &str) -> Result<LocalTagInfo, String> {
    let ref_name = format!("refs/tags/{tag_name}");
    let reference = repo.find_reference(&ref_name).map_err(|e| e.to_string())?;

    let oid = reference
        .target()
        .ok_or_else(|| format!("Could not resolve tag target: {tag_name}"))?;
    let object = repo.find_object(oid, None).map_err(|e| e.to_string())?;

    if object.kind() == Some(ObjectType::Tag) {
        let tag = repo.find_tag(oid).map_err(|e| e.to_string())?;
        return Ok(LocalTagInfo {
            object_id: oid.to_string(),
            target_id: tag.target_id().to_string(),
            is_annotated: true,
        });
    }

    Ok(LocalTagInfo {
        object_id: oid.to_string(),
        target_id: oid.to_string(),
        is_annotated: false,
    })
}

fn load_origin_tag_refs(path: &str) -> Result<BTreeMap<String, OriginTagInfo>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["ls-remote", "--tags", "origin"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "git ls-remote --tags origin failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(parse_ls_remote_tags(&String::from_utf8_lossy(
        &output.stdout,
    )))
}

fn parse_ls_remote_tags(output: &str) -> BTreeMap<String, OriginTagInfo> {
    #[derive(Debug, Default)]
    struct PendingOriginTag {
        object_id: Option<String>,
        peeled_target_id: Option<String>,
    }

    let mut pending: BTreeMap<String, PendingOriginTag> = BTreeMap::new();

    for line in output.lines() {
        let mut fields = line.split_whitespace();
        let Some(object_id) = fields.next() else {
            continue;
        };
        let Some(ref_name) = fields.next() else {
            continue;
        };
        let Some(tag_name) = ref_name.strip_prefix("refs/tags/") else {
            continue;
        };

        if let Some(base_name) = tag_name.strip_suffix("^{}") {
            pending
                .entry(base_name.to_string())
                .or_default()
                .peeled_target_id = Some(object_id.to_string());
        } else {
            pending.entry(tag_name.to_string()).or_default().object_id =
                Some(object_id.to_string());
        }
    }

    pending
        .into_iter()
        .filter_map(|(name, tag)| {
            tag.object_id.map(|object_id| {
                (
                    name,
                    OriginTagInfo {
                        object_id,
                        peeled_target_id: tag.peeled_target_id,
                    },
                )
            })
        })
        .collect()
}

fn merge_tag_refs(
    local_tags: BTreeMap<String, LocalTagInfo>,
    origin_tags: Result<BTreeMap<String, OriginTagInfo>, String>,
) -> GitTagRefsResponse {
    let origin_available = origin_tags.is_ok();
    let origin_error = origin_tags.as_ref().err().cloned();
    let origin_tags = origin_tags.unwrap_or_default();
    let mut names: BTreeSet<String> = local_tags.keys().cloned().collect();

    if origin_available {
        names.extend(origin_tags.keys().cloned());
    }

    let tags = names
        .into_iter()
        .map(|name| {
            let local = local_tags.get(&name);
            let origin = origin_tags.get(&name);
            let status = match (local, origin, origin_available) {
                (Some(_), None, false) => TagRefStatus::Unknown,
                (Some(local), Some(origin), true) if local.object_id == origin.object_id => {
                    TagRefStatus::LocalOrigin
                }
                (Some(_), Some(_), true) => TagRefStatus::Conflict,
                (Some(_), None, true) => TagRefStatus::Local,
                (None, Some(_), true) => TagRefStatus::Origin,
                _ => TagRefStatus::Unknown,
            };

            GitTagRef {
                name,
                local_object_id: local.map(|tag| tag.object_id.clone()),
                origin_object_id: origin.map(|tag| tag.object_id.clone()),
                local_target_id: local.map(|tag| tag.target_id.clone()),
                origin_target_id: origin.map(origin_target_id),
                status,
                is_local_annotated: local.is_some_and(|tag| tag.is_annotated),
            }
        })
        .collect();

    GitTagRefsResponse {
        tags,
        origin_available,
        origin_error,
    }
}

fn origin_target_id(tag: &OriginTagInfo) -> String {
    tag.peeled_target_id
        .clone()
        .unwrap_or_else(|| tag.object_id.clone())
}

fn local_tag_ref(name: String, tag: LocalTagInfo, status: TagRefStatus) -> GitTagRef {
    GitTagRef {
        name,
        local_object_id: Some(tag.object_id.clone()),
        origin_object_id: None,
        local_target_id: Some(tag.target_id),
        origin_target_id: None,
        status,
        is_local_annotated: tag.is_annotated,
    }
}

fn origin_tag_ref(name: String, tag: OriginTagInfo) -> GitTagRef {
    let target_id = origin_target_id(&tag);
    GitTagRef {
        name,
        local_object_id: None,
        origin_object_id: Some(tag.object_id),
        local_target_id: None,
        origin_target_id: Some(target_id),
        status: TagRefStatus::Origin,
        is_local_annotated: false,
    }
}

fn check_tag_name_availability_inner(
    path: &str,
    tag_name: &str,
) -> Result<TagNameAvailability, String> {
    let tag_name = tag_name.trim();
    let valid_name = !tag_name.is_empty() && validate_tag_name_format(tag_name).is_ok();
    if !valid_name {
        return Ok(TagNameAvailability {
            valid_name: false,
            local_exists: false,
            origin_exists: None,
            origin_available: false,
            origin_error: None,
        });
    }

    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let local_exists = find_local_tag_info(&repo, tag_name)?.is_some();
    let origin_tags = load_origin_tag_refs(path);
    let (origin_exists, origin_available, origin_error) = match origin_tags {
        Ok(tags) => (Some(tags.contains_key(tag_name)), true, None),
        Err(error) => (None, false, Some(error)),
    };

    Ok(TagNameAvailability {
        valid_name,
        local_exists,
        origin_exists,
        origin_available,
        origin_error,
    })
}

fn validate_tag_name(tag_name: &str) -> Result<&str, String> {
    let tag_name = tag_name.trim();
    if tag_name.is_empty() {
        return Err("Tag name is required".to_string());
    }
    Ok(tag_name)
}

fn validate_tag_name_format(tag_name: &str) -> Result<(), String> {
    let ref_name = format!("refs/tags/{tag_name}");
    let output = Command::new("git")
        .arg("check-ref-format")
        .arg(&ref_name)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!("Invalid tag name: {tag_name}"))
}

fn ensure_local_tag_exists(path: &str, tag_name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    find_local_tag_info(&repo, tag_name)?
        .map(|_| ())
        .ok_or_else(|| format!("Local tag does not exist: {tag_name}"))
}

fn origin_tag_exists(path: &str, tag_name: &str) -> Result<bool, String> {
    Ok(load_origin_tag_refs(path)?.contains_key(tag_name))
}

fn create_renamed_local_tag(
    repo: &Repository,
    new_tag_name: &str,
    old_object_id: &str,
) -> Result<(), String> {
    let old_oid = Oid::from_str(old_object_id).map_err(|e| e.to_string())?;
    let object = repo.find_object(old_oid, None).map_err(|e| e.to_string())?;

    if object.kind() == Some(ObjectType::Tag) {
        let tag = repo.find_tag(old_oid).map_err(|e| e.to_string())?;
        let target = tag.target().map_err(|e| e.to_string())?;
        let signature = repo
            .signature()
            .or_else(|_| Signature::now("Gitano", "gitano@example.invalid"))
            .map_err(|e| e.to_string())?;
        let message = tag.message().unwrap_or("");
        repo.tag(new_tag_name, &target, &signature, message, false)
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    repo.tag_lightweight(new_tag_name, &object, false)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn rename_local_tag(
    repo: &Repository,
    old_tag_name: &str,
    new_tag_name: &str,
    old_object_id: &str,
) -> Result<(), String> {
    if old_tag_name.eq_ignore_ascii_case(new_tag_name) && old_tag_name != new_tag_name {
        return rename_local_tag_case_only(repo, old_tag_name, new_tag_name, old_object_id);
    }

    create_renamed_local_tag(repo, new_tag_name, old_object_id)?;
    delete_local_tag(repo, old_tag_name)
}

fn rename_local_tag_case_only(
    repo: &Repository,
    old_tag_name: &str,
    new_tag_name: &str,
    old_object_id: &str,
) -> Result<(), String> {
    let temp_tag_name = temporary_rename_tag_name(repo)?;
    create_renamed_local_tag(repo, &temp_tag_name, old_object_id)?;
    delete_local_tag(repo, old_tag_name)?;

    if let Err(rename_error) = create_renamed_local_tag(repo, new_tag_name, old_object_id) {
        let _ = create_renamed_local_tag(repo, old_tag_name, old_object_id);
        let _ = delete_local_tag(repo, &temp_tag_name);
        return Err(rename_error);
    }

    delete_local_tag(repo, &temp_tag_name)
}

fn temporary_rename_tag_name(repo: &Repository) -> Result<String, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();

    for attempt in 0..100 {
        let candidate = format!("gitano/tmp/tag-rename-{timestamp}-{attempt}");
        if find_local_tag_info(repo, &candidate)?.is_none() {
            return Ok(candidate);
        }
    }

    Err("Could not allocate a temporary tag name for case-only rename.".to_string())
}

fn delete_local_tag(repo: &Repository, tag_name: &str) -> Result<(), String> {
    let ref_name = format!("refs/tags/{tag_name}");
    let mut reference = repo
        .find_reference(&ref_name)
        .map_err(|_| format!("Local tag does not exist: {tag_name}"))?;
    reference.delete().map_err(|e| e.to_string())
}

fn run_git_status(path: &str, args: &[&str], action: &str) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "{} failed: {}",
        action,
        String::from_utf8_lossy(&output.stderr)
    ))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::{commit_file, init_repo, run_git};
    use tempfile::tempdir;

    fn add_bare_origin(repo_path: &std::path::Path) -> tempfile::TempDir {
        let remote = tempdir().expect("bare remote should be created");
        run_git(remote.path(), &["init", "--bare"]);
        let remote_path = remote.path().to_string_lossy().to_string();
        run_git(repo_path, &["remote", "add", "origin", &remote_path]);
        remote
    }

    fn git_stdout(repo_path: &std::path::Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .args(args)
            .output()
            .expect("git command should run");

        assert!(
            output.status.success(),
            "git {:?} failed\nstdout: {}\nstderr: {}",
            args,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );

        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    #[test]
    fn parse_ls_remote_tags_deduplicates_annotated_peeled_refs() {
        let tags = parse_ls_remote_tags(
            "1111111111111111111111111111111111111111\trefs/tags/v1.0.0\n\
             2222222222222222222222222222222222222222\trefs/tags/v1.0.0^{}\n\
             3333333333333333333333333333333333333333\trefs/tags/v1.1.0\n",
        );

        assert_eq!(tags.len(), 2);
        assert_eq!(
            tags["v1.0.0"],
            OriginTagInfo {
                object_id: "1111111111111111111111111111111111111111".to_string(),
                peeled_target_id: Some("2222222222222222222222222222222222222222".to_string()),
            }
        );
    }

    #[test]
    fn merge_tag_refs_marks_local_tags_unknown_when_origin_unavailable() {
        let mut local_tags = BTreeMap::new();
        local_tags.insert(
            "v1.0.0".to_string(),
            LocalTagInfo {
                object_id: "local".to_string(),
                target_id: "target".to_string(),
                is_annotated: false,
            },
        );

        let response = merge_tag_refs(local_tags, Err("offline".to_string()));

        assert!(!response.origin_available);
        assert_eq!(response.tags[0].status, TagRefStatus::Unknown);
    }

    #[test]
    fn merge_tag_refs_marks_matching_and_conflicting_origin_tags() {
        let mut local_tags = BTreeMap::new();
        local_tags.insert(
            "same".to_string(),
            LocalTagInfo {
                object_id: "aaa".to_string(),
                target_id: "commit-a".to_string(),
                is_annotated: false,
            },
        );
        local_tags.insert(
            "different".to_string(),
            LocalTagInfo {
                object_id: "bbb".to_string(),
                target_id: "commit-b".to_string(),
                is_annotated: false,
            },
        );

        let mut origin_tags = BTreeMap::new();
        origin_tags.insert(
            "same".to_string(),
            OriginTagInfo {
                object_id: "aaa".to_string(),
                peeled_target_id: None,
            },
        );
        origin_tags.insert(
            "different".to_string(),
            OriginTagInfo {
                object_id: "ccc".to_string(),
                peeled_target_id: None,
            },
        );

        let response = merge_tag_refs(local_tags, Ok(origin_tags));
        let statuses: BTreeMap<_, _> = response
            .tags
            .into_iter()
            .map(|tag| (tag.name, tag.status))
            .collect();

        assert_eq!(statuses["same"], TagRefStatus::LocalOrigin);
        assert_eq!(statuses["different"], TagRefStatus::Conflict);
    }

    #[test]
    fn push_tag_does_not_require_remote_branch() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["tag", "v1.0.0"]);
        let _remote = add_bare_origin(repo.path());

        tauri::async_runtime::block_on(push_tag(
            repo.path().to_string_lossy().to_string(),
            "v1.0.0".to_string(),
        ))
        .expect("tag push should succeed without remote branch");

        let remote_ref = git_stdout(repo.path(), &["ls-remote", "--tags", "origin", "v1.0.0"]);
        assert!(remote_ref.contains("refs/tags/v1.0.0"));
    }

    #[test]
    fn load_tag_refs_keeps_origin_only_tags_visible() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["tag", "v1.0.0"]);
        let _remote = add_bare_origin(repo.path());
        run_git(repo.path(), &["push", "origin", "refs/tags/v1.0.0"]);
        run_git(repo.path(), &["tag", "-d", "v1.0.0"]);

        let response = load_tag_refs(&repo.path().to_string_lossy()).expect("tag refs should load");

        assert_eq!(response.tags.len(), 1);
        assert_eq!(response.tags[0].name, "v1.0.0");
        assert_eq!(response.tags[0].status, TagRefStatus::Origin);
    }

    #[test]
    fn rename_tag_preserves_annotated_message_without_pushing() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["tag", "-a", "v1.0.0", "-m", "release notes"]);

        tauri::async_runtime::block_on(rename_tag(
            repo.path().to_string_lossy().to_string(),
            "v1.0.0".to_string(),
            "v1.0.1".to_string(),
        ))
        .expect("rename should succeed");

        let tags = git_stdout(repo.path(), &["tag", "--list"]);
        let message = git_stdout(
            repo.path(),
            &["tag", "-l", "v1.0.1", "--format=%(contents)"],
        );

        assert!(!tags.lines().any(|tag| tag == "v1.0.0"));
        assert!(tags.lines().any(|tag| tag == "v1.0.1"));
        assert_eq!(message, "release notes");
    }

    #[test]
    fn tag_name_availability_uses_exact_case_for_local_tags() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["tag", "Refactor-final-v1"]);

        let availability =
            check_tag_name_availability_inner(&repo.path().to_string_lossy(), "refactor-final-v1")
                .expect("availability should be computed");

        assert!(!availability.local_exists);
    }

    #[test]
    fn rename_tag_allows_case_only_name_changes() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["tag", "Refactor-final-v1"]);

        tauri::async_runtime::block_on(rename_tag(
            repo.path().to_string_lossy().to_string(),
            "Refactor-final-v1".to_string(),
            "refactor-final-v1".to_string(),
        ))
        .expect("case-only rename should succeed");

        let tags = git_stdout(repo.path(), &["tag", "--list"]);
        assert!(!tags.lines().any(|tag| tag == "Refactor-final-v1"));
        assert!(tags.lines().any(|tag| tag == "refactor-final-v1"));
    }

    #[test]
    fn rename_tag_rejects_known_origin_name_conflict() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["tag", "local-name"]);
        run_git(repo.path(), &["tag", "remote-name"]);
        let _remote = add_bare_origin(repo.path());
        run_git(repo.path(), &["push", "origin", "refs/tags/remote-name"]);
        run_git(repo.path(), &["tag", "-d", "remote-name"]);

        let error = tauri::async_runtime::block_on(rename_tag(
            repo.path().to_string_lossy().to_string(),
            "local-name".to_string(),
            "remote-name".to_string(),
        ))
        .expect_err("origin conflict should be rejected");

        assert_eq!(error, "Origin tag already exists: remote-name");
    }

    #[test]
    fn delete_tag_keeps_local_tag_when_origin_delete_fails() {
        let repo = init_repo();
        commit_file(repo.path(), "file.txt", "content\n", "initial");
        run_git(repo.path(), &["tag", "v1.0.0"]);

        let result = tauri::async_runtime::block_on(delete_tag(
            repo.path().to_string_lossy().to_string(),
            "v1.0.0".to_string(),
            true,
            true,
        ));

        assert!(result.is_err());
        assert_eq!(
            git_stdout(repo.path(), &["tag", "--list", "v1.0.0"]),
            "v1.0.0"
        );
    }
}
