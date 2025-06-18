use git2::{BranchType, Repository};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

#[derive(serde::Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
}

#[derive(serde::Serialize)]
pub struct CommitNode {
    pub id: String,
    pub parents: Vec<String>,
    pub message: String,
    pub author: String,
    pub branches: Vec<String>,
    pub is_head: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub date: i64,
    pub message: String,
    pub heads: Vec<String>,
    pub tags: Vec<GitTag>,
    pub remotes: Vec<GitRemote>,
    pub stash: Option<GitStash>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitTag {
    pub name: String,
    pub annotated: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitRemote {
    pub name: String,
    pub remote: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStash {
    pub hash: String,
    pub base_hash: String,
    pub untracked_files_hash: String,
    pub selector: String,
    pub author: String,
    pub email: String,
    pub date: i64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommitData {
    pub commits: Vec<GitCommit>,
    pub head: Option<String>,
    pub tags: Vec<String>,
    pub more_commits_available: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitRefData {
    pub head: Option<String>,
    pub heads: Vec<String>,
    pub tags: Vec<String>,
    pub remotes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum CommitOrdering {
    Date,
    Topo,
    AuthorDate,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitListItem {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub date: i64,
    pub current_branch: String,
    pub source_branch: String,
    pub pr: Option<String>,
    pub merged_in: Option<String>,
    pub files: usize,
    pub ci: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitListPage {
    pub commits: Vec<CommitListItem>,
    pub has_more: bool,
}

#[command]
pub fn open_local_repo(path: String) -> Result<String, String> {
    match Repository::open(&path) {
        Ok(_) => Ok(format!("Repositorio abierto correctamente: {}", path)),
        Err(e) => Err(format!("No es un repositorio git válido: {}", e)),
    }
}

#[command]
pub fn get_branches(path: String) -> Result<Vec<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut branches = Vec::new();
    let branch_iter = repo.branches(None).map_err(|e| e.to_string())?;
    for branch in branch_iter {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        if let Some(name) = branch.name().map_err(|e| e.to_string())? {
            branches.push(name.to_string());
        }
    }
    Ok(branches)
}

#[command]
pub fn get_commits(path: String) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    let mut commits = Vec::new();
    for oid_result in revwalk.take(50) {
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        commits.push(CommitInfo {
            hash: commit.id().to_string(),
            message: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
        });
    }
    Ok(commits)
}

#[command]
pub fn get_commit_graph(path: String) -> Result<Vec<CommitNode>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;

    let mut commit_to_branches: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    let mut head_commits = std::collections::HashSet::new();
    for branch in repo.branches(None).map_err(|e| e.to_string())? {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        if let Some(name) = branch.name().map_err(|e| e.to_string())? {
            if let Some(target) = branch.get().target() {
                let id = target.to_string();
                commit_to_branches
                    .entry(id.clone())
                    .or_default()
                    .push(name.to_string());
                head_commits.insert(id);
            }
        }
    }

    let mut commit_to_tags: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for tag in repo
        .tag_names(None)
        .map_err(|e| e.to_string())?
        .iter()
        .flatten()
    {
        if let Ok(reference) = repo.revparse_single(tag) {
            let id = reference.id().to_string();
            commit_to_tags.entry(id).or_default().push(tag.to_string());
        }
    }

    let mut nodes = Vec::new();
    for oid_result in revwalk.take(200) {
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let parents = commit.parent_ids().map(|p| p.to_string()).collect();
        let id = commit.id().to_string();
        let branches = commit_to_branches.get(&id).cloned().unwrap_or_default();
        let is_head = head_commits.contains(&id);
        let tags = commit_to_tags.get(&id).cloned().unwrap_or_default();
        nodes.push(CommitNode {
            id,
            parents,
            message: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            branches,
            is_head,
            tags,
        });
    }
    Ok(nodes)
}

#[command]
pub fn get_remote_branches(path: String) -> Result<Vec<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut branches = Vec::new();
    let branch_iter = repo
        .branches(Some(BranchType::Remote))
        .map_err(|e| e.to_string())?;
    for branch in branch_iter {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        if let Some(name) = branch.name().map_err(|e| e.to_string())? {
            branches.push(name.to_string());
        }
    }
    Ok(branches)
}

#[command]
pub fn get_formatted_commits(
    path: String,
    branches: Option<Vec<String>>,
    authors: Option<Vec<String>>,
    max_commits: usize,
    show_tags: bool,
    show_remote_branches: bool,
    include_commits_mentioned_by_reflogs: bool,
    only_follow_first_parent: bool,
    remotes: Vec<String>,
    hide_remotes: Vec<String>,
    stashes: Vec<GitStash>,
) -> Result<GitCommitData, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;

    // Configure revwalk based on options
    if only_follow_first_parent {
        revwalk.simplify_first_parent().map_err(|e| e.to_string())?;
    }

    // Push references based on options
    if show_tags {
        for tag in repo
            .tag_names(None)
            .map_err(|e| e.to_string())?
            .iter()
            .flatten()
        {
            if let Ok(reference) = repo.revparse_single(tag) {
                let target = reference.id();
                revwalk.push(target).map_err(|e| e.to_string())?;
            }
        }
    }

    if show_remote_branches {
        for remote in &remotes {
            if !hide_remotes.contains(remote) {
                if let Ok(reference) = repo.find_reference(&format!("refs/remotes/{}/HEAD", remote))
                {
                    if let Some(target) = reference.target() {
                        revwalk.push(target).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
    }

    if include_commits_mentioned_by_reflogs {
        for reference in repo.references().map_err(|e| e.to_string())? {
            if let Ok(reference) = reference {
                if let Some(target) = reference.target() {
                    revwalk.push(target).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // Push branches if specified
    if let Some(branches) = branches {
        for branch in branches {
            if let Ok(reference) = repo.find_reference(&format!("refs/heads/{}", branch)) {
                if let Some(target) = reference.target() {
                    revwalk.push(target).map_err(|e| e.to_string())?;
                }
            }
        }
    } else {
        revwalk.push_head().map_err(|e| e.to_string())?;
    }

    // Get commits
    let mut commits = Vec::new();
    let mut more_commits_available = false;

    for (i, oid_result) in revwalk.enumerate() {
        if i >= max_commits {
            more_commits_available = true;
            break;
        }

        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let author_name = commit.author().name().unwrap_or("").to_string();
        // Filtro por autores si corresponde
        if let Some(ref authors_list) = authors {
            if !authors_list.contains(&author_name) {
                continue;
            }
        }
        commits.push(GitCommit {
            hash: commit.id().to_string(),
            parents: commit.parent_ids().map(|p| p.to_string()).collect(),
            author: author_name,
            email: commit.author().email().unwrap_or("").to_string(),
            date: commit.author().when().seconds(),
            message: commit.summary().unwrap_or("").to_string(),
            heads: Vec::new(),
            tags: Vec::new(),
            remotes: Vec::new(),
            stash: None,
        });
    }

    // Get refs
    let mut ref_data = GitRefData {
        head: None,
        heads: Vec::new(),
        tags: Vec::new(),
        remotes: Vec::new(),
    };

    // Get HEAD
    if let Ok(head) = repo.head() {
        if let Some(target) = head.target() {
            ref_data.head = Some(target.to_string());
        }
    }

    // Get branches, tags, and remotes
    let mut remote_refs: Vec<(String, String)> = Vec::new(); // (commit_hash, remote_name)
    for reference in repo.references().map_err(|e| e.to_string())? {
        if let Ok(reference) = reference {
            let name = reference.name().unwrap_or("");
            if name == "HEAD" {
                continue;
            } else if name.starts_with("refs/heads/") {
                if let Some(target) = reference.target() {
                    ref_data.heads.push(target.to_string());
                }
            } else if name.starts_with("refs/tags/") {
                if let Some(target) = reference.target() {
                    ref_data.tags.push(target.to_string());
                }
            } else if name.starts_with("refs/remotes/") {
                let remote = name.split('/').nth(2).unwrap_or("");
                if !hide_remotes.contains(&remote.to_string()) {
                    if let Some(target) = reference.target() {
                        ref_data.remotes.push(target.to_string());
                        remote_refs.push((target.to_string(), remote.to_string()));
                    }
                }
            }
        }
    }

    // Add refs to commits
    let mut commit_lookup: HashMap<String, usize> = HashMap::new();
    for (i, commit) in commits.iter().enumerate() {
        commit_lookup.insert(commit.hash.clone(), i);
    }

    // heads: nombres de ramas locales que apuntan a cada commit
    for reference in repo.references().map_err(|e| e.to_string())? {
        if let Ok(reference) = reference {
            let name = reference.name().unwrap_or("");
            if name.starts_with("refs/heads/") {
                if let Some(target) = reference.target() {
                    if let Some(&index) = commit_lookup.get(&target.to_string()) {
                        // Extrae el nombre de la rama después de 'refs/heads/'
                        if let Some(branch_name) = name.strip_prefix("refs/heads/") {
                            commits[index].heads.push(branch_name.to_string());
                        }
                    }
                }
            }
        }
    }

    // TAGS: Detect annotated vs lightweight
    for tag in repo
        .tag_names(None)
        .map_err(|e| e.to_string())?
        .iter()
        .flatten()
    {
        if let Ok(object) = repo.revparse_single(tag) {
            let id = object.id();
            let annotated = match repo.find_tag(object.id()) {
                Ok(_) => true,
                Err(_) => false,
            };
            if let Some(&index) = commit_lookup.get(&id.to_string()) {
                commits[index].tags.push(GitTag {
                    name: tag.to_string(),
                    annotated,
                });
            }
        }
    }

    // REMOTES: Anotar remotes en los commits
    for (commit_hash, remote_name) in remote_refs {
        if let Some(&index) = commit_lookup.get(&commit_hash) {
            commits[index].remotes.push(GitRemote {
                name: remote_name.clone(),
                remote: Some(remote_name),
            });
        }
    }

    // Add stashes
    for stash in stashes {
        if let Some(&index) = commit_lookup.get(&stash.base_hash) {
            commits[index].stash = Some(stash);
        }
    }

    // Uncommitted Changes: Si hay cambios no commiteados, agrega un commit especial
    if let Ok(statuses) = repo.statuses(None) {
        let has_uncommitted = statuses.iter().any(|entry| {
            let s = entry.status();
            s.is_index_new()
                || s.is_index_modified()
                || s.is_index_deleted()
                || s.is_wt_new()
                || s.is_wt_modified()
                || s.is_wt_deleted()
        });
        if has_uncommitted {
            let head_hash = ref_data.head.clone().unwrap_or_default();
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            let num_changes = statuses.iter().count();
            let uncommitted_commit = GitCommit {
                hash: "UNCOMMITTED".to_string(),
                parents: if head_hash.is_empty() {
                    vec![]
                } else {
                    vec![head_hash]
                },
                author: "*".to_string(),
                email: "".to_string(),
                date: now,
                message: format!("Uncommitted Changes ({})", num_changes),
                heads: vec![],
                tags: vec![],
                remotes: vec![],
                stash: None,
            };
            commits.insert(0, uncommitted_commit);
        }
    }

    Ok(GitCommitData {
        commits,
        head: ref_data.head,
        tags: ref_data.tags,
        more_commits_available,
        error: None,
    })
}

#[command]
pub fn get_commits_list_paginated(
    path: String,
    branch: String,
    offset: usize,
    limit: usize,
) -> Result<CommitListPage, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    if branch.trim().is_empty() {
        revwalk.push_head().map_err(|e| e.to_string())?;
    } else {
        let branch_ref = format!("refs/heads/{}", branch);
        let reference = repo
            .find_reference(&branch_ref)
            .map_err(|e| e.to_string())?;
        let target = reference.target().ok_or("No target for branch")?;
        revwalk.push(target).map_err(|e| e.to_string())?;
    }
    let mut rows = Vec::new();
    let mut skipped = 0;
    let mut taken = 0;
    let mut has_more = false;
    for oid_result in revwalk {
        if skipped < offset {
            skipped += 1;
            continue;
        }
        if taken >= limit {
            has_more = true;
            break;
        }
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let sha = commit.id().to_string();
        let message = commit.summary().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("").to_string();
        let date = commit.time().seconds();
        let current_branch = branch.clone();
        let source_branch = branch.clone(); // Placeholder
        let pr = None;
        let merged_in = None;
        let files = commit.tree().map(|t| t.len()).unwrap_or(0);
        let ci = None;
        rows.push(CommitListItem {
            sha,
            message,
            author,
            date,
            current_branch,
            source_branch,
            pr,
            merged_in,
            files,
            ci,
        });
        taken += 1;
    }
    Ok(CommitListPage {
        commits: rows,
        has_more,
    })
}
