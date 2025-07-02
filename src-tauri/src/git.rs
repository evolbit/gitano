use git2::StatusOptions;
use git2::{BranchType, Oid, Repository};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

static COMMIT_BRANCH_MAP_CACHE: Lazy<Mutex<HashMap<String, HashMap<Oid, String>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

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
    pub ci: Option<String>,
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
    pub commit_history: Vec<String>,
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
        ci: None,
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
                tags: Vec::new(),
                remotes: Vec::new(),
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

fn get_all_branch_tips(repo: &Repository) -> Result<HashMap<Oid, Vec<String>>, git2::Error> {
    let mut tips = HashMap::new();
    for branch_res in repo.branches(None)? {
        if let Ok((branch, _)) = branch_res {
            if let Some(oid) = branch.get().target() {
                if let Ok(Some(name)) = branch.name() {
                    tips.entry(oid)
                        .or_insert_with(Vec::new)
                        .push(name.to_string());
                }
            }
        }
    }
    Ok(tips)
}

fn get_merge_source_branch(message: &str) -> Option<String> {
    let summary = message.lines().next().unwrap_or(message);

    let patterns = [
        ("Merge branch '", Some("'")),
        ("Merge remote-tracking branch '", Some("'")),
        ("Merge tag '", Some("'")),
        ("Merged in ", Some(" into ")),
        ("Merged in ", None), // Must be after the one with " into "
    ];

    for (pattern, terminator) in &patterns {
        if let Some(start) = summary.find(pattern) {
            let start = start + pattern.len();
            let rest = &summary[start..];

            if let Some(terminator_str) = terminator {
                if let Some(end) = rest.find(terminator_str) {
                    return Some(rest[..end].trim().to_string());
                }
            } else {
                return Some(rest.trim().to_string());
            }
        }
    }
    None
}

fn get_main_branch_tip(repo: &Repository) -> Result<Option<Oid>, git2::Error> {
    for branch_name in &["main", "master"] {
        if let Ok(branch) = repo.find_branch(branch_name, BranchType::Local) {
            if let Some(tip) = branch.get().target() {
                return Ok(Some(tip));
            }
        }
    }
    Ok(None)
}

fn build_commit_branch_map(repo: &Repository) -> Result<HashMap<Oid, String>, git2::Error> {
    let mut commit_branch_map: HashMap<Oid, String> = HashMap::new();
    let mut branches_to_process = Vec::new();

    let _develop_branch_tip = repo
        .find_branch("develop", BranchType::Local)
        .and_then(|b| {
            b.get()
                .target()
                .ok_or_else(|| git2::Error::from_str("No target for develop branch"))
        })
        .or_else(|_| {
            repo.find_branch("origin/develop", BranchType::Remote)
                .and_then(|b| {
                    b.get()
                        .target()
                        .ok_or_else(|| git2::Error::from_str("No target for origin/develop branch"))
                })
        })
        .ok();

    let _main_branch_tip = get_main_branch_tip(repo)?;

    let all_branches: Vec<_> = repo.branches(None)?.filter_map(Result::ok).collect();

    for (branch, branch_type) in all_branches {
        if let (Some(branch_tip), Some(branch_name_full)) = (branch.get().target(), branch.name()?)
        {
            let branch_name_full = branch_name_full.to_string();
            let branch_name_short = (if branch_type == BranchType::Remote {
                branch_name_full.splitn(2, '/').last().unwrap_or("")
            } else {
                &branch_name_full
            })
            .to_string();

            let priority = match branch_name_short.as_str() {
                "main" | "master" => 0,
                "develop" => 1,
                s if s.starts_with("release/") => 2,
                s if s.starts_with("hotfix/") => 3,
                s if s.starts_with("feature/") => 4,
                _ => 5,
            };

            if let Ok(commit) = repo.find_commit(branch_tip) {
                let commit_time = commit.time().seconds();
                branches_to_process.push((
                    branch_tip,
                    branch_name_full,
                    branch_name_short,
                    priority,
                    commit_time,
                ));
            }
        }
    }

    // Sort by priority to ensure feature/release branches are processed before develop/main
    branches_to_process.sort_by_key(|k| std::cmp::Reverse(k.3));

    // Limit to the most recent 100 branches for performance
    const MAX_BRANCHES_TO_PROCESS: usize = 100;
    if branches_to_process.len() > MAX_BRANCHES_TO_PROCESS {
        branches_to_process.truncate(MAX_BRANCHES_TO_PROCESS);
    }

    for (branch_tip, branch_name_full, _branch_name_short, _priority, _commit_time) in
        branches_to_process
    {
        // For each branch, walk through all its commits and assign them to this branch
        if let Ok(mut revwalk) = repo.revwalk() {
            if revwalk.push(branch_tip).is_ok() {
                // Limit the depth to avoid processing too many commits
                let mut commit_count = 0;
                const MAX_COMMITS_PER_BRANCH: usize = 500;
                for oid_res in revwalk.take(MAX_COMMITS_PER_BRANCH) {
                    if let Ok(oid) = oid_res {
                        // Only insert if this commit hasn't been assigned to a higher priority branch
                        commit_branch_map
                            .entry(oid)
                            .or_insert_with(|| branch_name_full.clone());
                        commit_count += 1;
                    }
                }
                println!(
                    "Processed {} commits for branch {}",
                    commit_count, branch_name_full
                );
            }
        }
    }

    Ok(commit_branch_map)
}

#[command]
pub fn get_commits_list_paginated(
    path: String,
    branch: String,
    offset: usize,
    limit: usize,
) -> Result<CommitListPage, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;

    let repo_path_key = repo.path().to_str().unwrap_or_default().to_string();
    let mut cache = COMMIT_BRANCH_MAP_CACHE.lock().unwrap();

    if !cache.contains_key(&repo_path_key) {
        let map = build_commit_branch_map(&repo).map_err(|e| e.to_string())?;
        cache.insert(repo_path_key.clone(), map);
    }

    let commit_branch_map = cache.get(&repo_path_key).unwrap();
    let branch_tips = get_all_branch_tips(&repo).map_err(|e| e.to_string())?;

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;

    if branch.trim().is_empty() {
        revwalk.push_head().map_err(|e| e.to_string())?;
    } else {
        // Soporta ramas locales y remotas
        let mut found = false;
        let refs_to_try = if branch.contains('/') {
            vec![
                format!("refs/heads/{}", branch),
                format!("refs/remotes/{}", branch),
            ]
        } else {
            vec![
                format!("refs/heads/{}", branch),
                format!("refs/remotes/origin/{}", branch),
            ]
        };
        for branch_ref in refs_to_try {
            if let Ok(reference) = repo.find_reference(&branch_ref) {
                if let Some(target) = reference.target() {
                    revwalk.push(target).map_err(|e| e.to_string())?;
                    found = true;
                    break;
                }
            }
        }
        if !found {
            return Err(format!("Branch reference not found for '{}'", branch));
        }
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
        let current_branch = if branch.trim().is_empty() {
            // Intentar obtener el nombre de la rama actual (HEAD)
            if let Ok(head) = repo.head() {
                if let Some(name) = head.shorthand() {
                    name.to_string()
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        } else {
            branch.clone()
        };

        let source_branch = if commit.parent_count() > 1 {
            let parent2 = commit.parent_id(1).ok();
            if let Some(parent2_id) = parent2 {
                // Buscar nombre de rama que apunte al segundo padre
                let mut source_branch = String::new();
                if let Ok(branches) = repo.branches(None) {
                    for branch in branches.flatten() {
                        let (b, _) = branch;
                        if let Some(target) = b.get().target() {
                            if target == parent2_id {
                                if let Ok(Some(name)) = b.name() {
                                    source_branch = name.to_string();
                                    break;
                                }
                            }
                        }
                    }
                }
                source_branch
            } else {
                String::new()
            }
        } else {
            current_branch.clone()
        };

        let mut history = Vec::new();

        // 1. Es un commit de merge?
        let commit_message = commit.message().unwrap_or("");
        if commit.parent_count() > 1 {
            if let Some(source) = get_merge_source_branch(commit_message) {
                history.push(source);
            } else if let Ok(parent2_id) = commit.parent_id(1) {
                if let Some(branch_from_map) = commit_branch_map.get(&parent2_id) {
                    history.push(branch_from_map.clone());
                }
            }
        }

        // 2. Es la punta de una rama? (Puede ser un merge y también una punta)
        if let Some(tip_branches) = branch_tips.get(&commit.id()) {
            for tip in tip_branches {
                if !history.contains(tip) {
                    history.push(tip.clone());
                }
            }
        }

        // 3. Si no hemos encontrado nada, usamos el mapa pre-calculado.
        if history.is_empty() {
            if let Some(branch_from_map) = commit_branch_map.get(&commit.id()) {
                history.push(branch_from_map.clone());
            }
        }

        // Eliminar duplicados y preferir ramas locales sobre remotas
        history.sort();
        history.dedup();

        let mut to_remove = HashSet::<String>::new();
        let local_branches: HashSet<String> = history
            .iter()
            .filter_map(|b| {
                if b.starts_with("origin/") || b.starts_with("refs/remotes/") {
                    None
                } else if let Some(stripped) = b.strip_prefix("refs/heads/") {
                    Some(stripped.to_string())
                } else {
                    Some(b.clone())
                }
            })
            .collect();

        for branch in &history {
            let remote_equivalent = if let Some(stripped) = branch.strip_prefix("origin/") {
                Some(stripped)
            } else if let Some(stripped) = branch.strip_prefix("refs/remotes/origin/") {
                Some(stripped)
            } else {
                None
            };

            if let Some(remote_eq) = remote_equivalent {
                if local_branches.contains(remote_eq) {
                    to_remove.insert(branch.clone());
                }
            }
        }
        history.retain(|b| !to_remove.contains(b));

        let pr = None;
        let merged_in = None;

        let files = (|| -> Result<usize, git2::Error> {
            if commit.parent_count() > 0 {
                let parent = commit.parent(0)?;
                let diff =
                    repo.diff_tree_to_tree(Some(&parent.tree()?), Some(&commit.tree()?), None)?;
                Ok(diff.stats()?.files_changed())
            } else {
                // Commit inicial
                Ok(commit.tree()?.len())
            }
        })()
        .map_err(|e| e.to_string())?;

        let ci = None;

        rows.push(CommitListItem {
            sha,
            message,
            author,
            date,
            current_branch: String::new(), // Ya no necesitamos mostrar esto separado
            source_branch,
            commit_history: history,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ChangeType {
    Added,
    Deleted,
    Modified,
    Renamed,
    Copied,
    TypeChanged,
}

impl From<git2::Delta> for ChangeType {
    fn from(delta: git2::Delta) -> Self {
        match delta {
            git2::Delta::Added => ChangeType::Added,
            git2::Delta::Deleted => ChangeType::Deleted,
            git2::Delta::Modified => ChangeType::Modified,
            git2::Delta::Renamed => ChangeType::Renamed,
            git2::Delta::Copied => ChangeType::Copied,
            git2::Delta::Typechange => ChangeType::TypeChanged,
            _ => ChangeType::Modified, // Default or handle other cases
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileChange {
    path: String,
    status: ChangeType,
    insertions: u32,
    deletions: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitDiff {
    commit_sha: String,
    changes: Vec<FileChange>,
}

#[command]
pub fn get_commit_diff(path: String, sha: String) -> Result<CommitDiff, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let oid = Oid::from_str(&sha).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    // Get the parent commit to create a diff. If there's no parent, it's the initial commit.
    let parent_commit = if commit.parent_count() > 0 {
        Some(commit.parent(0).map_err(|e| e.to_string())?)
    } else {
        None
    };
    let parent_tree = parent_commit.as_ref().map(|p| p.tree().unwrap());
    let commit_tree = commit.tree().map_err(|e| e.to_string())?;

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
        .map_err(|e| e.to_string())?;

    let mut changes = Vec::new();

    // We iterate through the deltas in the diff.
    for i in 0..diff.deltas().len() {
        let delta = diff.get_delta(i).unwrap(); // Safe inside this loop
        let status = delta.status();
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        // Create a patch for this delta to get line stats.
        // Patch may not be created for binary files.
        let patch_result = git2::Patch::from_diff(&diff, i);

        let (insertions, deletions) = if let Ok(Some(patch)) = patch_result {
            // `line_stats()` gives (context, additions, deletions)
            if let Ok(stats) = patch.line_stats() {
                (stats.1 as u32, stats.2 as u32)
            } else {
                (0, 0) // No line stats available or error
            }
        } else {
            (0, 0) // Error creating patch or binary file
        };

        changes.push(FileChange {
            path,
            status: status.into(),
            insertions,
            deletions,
        });
    }

    Ok(CommitDiff {
        commit_sha: sha.to_string(),
        changes,
    })
}

#[command]
pub fn amend_commit_message(path: String, sha: String, new_message: String) -> Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let oid = Oid::from_str(&sha).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    // No se puede enmendar un commit de merge
    if commit.parent_count() > 1 {
        return Err("Cannot amend a merge commit.".to_string());
    }

    // Solo enmendar si el commit es el HEAD actual de alguna rama
    let head = repo.head().map_err(|e| e.to_string())?;
    let head_oid = head.target().ok_or("Could not get HEAD OID")?;

    if head_oid != oid {
        return Err("Can only amend the most recent commit on the current branch.".to_string());
    }

    commit
        .amend(None, None, None, None, Some(&new_message), None)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn get_current_branch(path: String) -> Result<String, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;
    if head.is_branch() {
        head.shorthand()
            .map(|s| s.to_string())
            .ok_or_else(|| "Could not get branch shorthand".to_string())
    } else {
        Ok("Detached HEAD".to_string())
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub enum DiffLineKind {
    Add,
    Del,
    Context,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub content: String,
    pub old_lineno: Option<usize>,
    pub new_lineno: Option<usize>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<DiffLine>,
    pub is_new_file: bool,
}

fn parse_unified_diff(diff: &str) -> Vec<DiffHunk> {
    use regex::Regex;
    let hunk_re = Regex::new(r"^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@").unwrap();
    let mut hunks = Vec::new();
    let mut lines = diff.lines().peekable();

    while let Some(line) = lines.next() {
        if let Some(cap) = hunk_re.captures(line) {
            let old_start = cap[1].parse::<usize>().unwrap();
            let old_lines = cap.get(2).map_or(1, |m| m.as_str().parse().unwrap_or(1));
            let new_start = cap[3].parse::<usize>().unwrap();
            let new_lines = cap.get(4).map_or(1, |m| m.as_str().parse().unwrap_or(1));
            let mut hunk_lines = Vec::new();
            let mut old_lineno = old_start;
            let mut new_lineno = new_start;
            while let Some(&next_line) = lines.peek() {
                if next_line.starts_with("@@") {
                    break;
                }
                let (kind, content, old_num, new_num) = if next_line.starts_with('+') {
                    (DiffLineKind::Add, &next_line[1..], None, Some(new_lineno))
                } else if next_line.starts_with('-') {
                    (DiffLineKind::Del, &next_line[1..], Some(old_lineno), None)
                } else {
                    (
                        DiffLineKind::Context,
                        if next_line.starts_with(' ') {
                            &next_line[1..]
                        } else {
                            next_line
                        },
                        Some(old_lineno),
                        Some(new_lineno),
                    )
                };
                hunk_lines.push(DiffLine {
                    kind,
                    content: content.to_string(),
                    old_lineno: old_num,
                    new_lineno: new_num,
                });
                match kind {
                    DiffLineKind::Add => new_lineno += 1,
                    DiffLineKind::Del => old_lineno += 1,
                    DiffLineKind::Context => {
                        old_lineno += 1;
                        new_lineno += 1;
                    }
                }
                lines.next();
            }
            hunks.push(DiffHunk {
                header: line.to_string(),
                old_start,
                old_lines,
                new_start,
                new_lines,
                lines: hunk_lines,
                is_new_file: false,
            });
        }
    }
    hunks
}

#[tauri::command]
pub fn get_file_diff_hunks(
    path: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    use std::fs;
    use std::path::Path;
    use std::process::Command;

    // Verificar si el archivo existe en el working directory
    let file_path_obj = Path::new(&file_path);
    let full_path = Path::new(&path).join(file_path_obj);

    if !full_path.exists() {
        return Ok(vec![]); // Archivo no existe, no hay diff
    }

    // Verificar si el archivo está en el índice de Git
    let ls_files_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("ls-files")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    let is_tracked = !ls_files_output.stdout.is_empty();

    // Si el archivo no está trackeado, es un archivo nuevo
    if !is_tracked {
        // Leer el contenido del archivo
        let file_content = fs::read_to_string(&full_path).map_err(|e| e.to_string())?;

        let lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

        // Crear un hunk especial para archivo nuevo
        let diff_lines: Vec<DiffLine> = lines
            .iter()
            .enumerate()
            .map(|(i, line)| DiffLine {
                kind: DiffLineKind::Add,
                content: line.clone(),
                old_lineno: None,
                new_lineno: Some(i + 1),
            })
            .collect();

        let hunk = DiffHunk {
            header: format!("@@ -0,0 +1,{} @@", lines.len()),
            old_start: 0,
            old_lines: 0,
            new_start: 1,
            new_lines: lines.len(),
            lines: diff_lines,
            is_new_file: true,
        };

        return Ok(vec![hunk]);
    }

    // Archivo trackeado, obtener diff normal
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg(format!("-U{}", context))
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;
    let diff = String::from_utf8_lossy(&output.stdout);

    if diff.trim().is_empty() {
        return Ok(vec![]); // No hay cambios
    }

    let mut hunks = parse_unified_diff(&diff);
    // Marcar todos los hunks como no nuevos
    for hunk in &mut hunks {
        hunk.is_new_file = false;
    }

    Ok(hunks)
}

#[derive(Deserialize)]
pub enum ContextDirection {
    Above,
    Below,
}

#[tauri::command]
pub fn get_diff_context(
    path: String,
    file_path: String,
    hunk_index: usize,
    direction: ContextDirection,
    lines: usize,
    context: usize,
    offset: usize,
) -> Result<Vec<DiffLine>, String> {
    // 1. Obtener los hunks actuales
    let hunks = get_file_diff_hunks(path.clone(), file_path.clone(), context)?;
    if hunk_index >= hunks.len() {
        return Err("Hunk index out of range".to_string());
    }
    let hunk = &hunks[hunk_index];
    // 2. Leer el archivo original
    use std::fs::File;
    use std::io::{BufRead, BufReader};
    let file = File::open(format!("{}/{}", path, file_path)).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(Result::ok).collect();
    let mut result = Vec::new();
    match direction {
        ContextDirection::Above => {
            let start = if hunk.old_start > lines + offset {
                hunk.old_start - lines - offset - 1
            } else {
                0
            };
            let end = if hunk.old_start > offset {
                hunk.old_start - offset - 1
            } else {
                0
            };
            for i in start..end {
                result.push(DiffLine {
                    kind: DiffLineKind::Context,
                    content: all_lines.get(i).cloned().unwrap_or_default(),
                    old_lineno: Some(i + 1),
                    new_lineno: Some(i + 1),
                });
            }
        }
        ContextDirection::Below => {
            let start = hunk.old_start + hunk.old_lines - 1 + offset;
            let end = std::cmp::min(start + lines, all_lines.len());
            for i in start..end {
                result.push(DiffLine {
                    kind: DiffLineKind::Context,
                    content: all_lines.get(i).cloned().unwrap_or_default(),
                    old_lineno: Some(i + 1),
                    new_lineno: Some(i + 1),
                });
            }
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn get_commit_file_diff(
    path: String,
    sha: String,
    file_path: String,
    context: usize,
) -> Result<Vec<DiffHunk>, String> {
    use std::process::Command;

    // Verificar si el archivo existe en el commit
    let show_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("show")
        .arg(format!("{}:./{}", sha, file_path))
        .output();

    match show_output {
        Ok(output) => {
            let file_content = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

            // Verificar si el archivo existe en el commit padre
            let parent_show_output = Command::new("git")
                .arg("-C")
                .arg(&path)
                .arg("show")
                .arg(format!("{}^:./{}", sha, file_path))
                .output();

            match parent_show_output {
                Ok(_) => {
                    // El archivo existe en ambos commits, obtener diff normal
                    let diff_output = Command::new("git")
                        .arg("-C")
                        .arg(&path)
                        .arg("diff")
                        .arg(format!("-U{}", context))
                        .arg(format!("{}^", sha))
                        .arg(&sha)
                        .arg("--")
                        .arg(&file_path)
                        .output()
                        .map_err(|e| e.to_string())?;
                    let diff = String::from_utf8_lossy(&diff_output.stdout);

                    if diff.trim().is_empty() {
                        return Ok(vec![]); // No hay cambios
                    }

                    let mut hunks = parse_unified_diff(&diff);
                    // Marcar todos los hunks como no nuevos
                    for hunk in &mut hunks {
                        hunk.is_new_file = false;
                    }

                    Ok(hunks)
                }
                Err(_) => {
                    // El archivo no existe en el commit padre, es un archivo nuevo
                    let diff_lines: Vec<DiffLine> = lines
                        .iter()
                        .enumerate()
                        .map(|(i, line)| DiffLine {
                            kind: DiffLineKind::Add,
                            content: line.clone(),
                            old_lineno: None,
                            new_lineno: Some(i + 1),
                        })
                        .collect();

                    let hunk = DiffHunk {
                        header: format!("@@ -0,0 +1,{} @@", lines.len()),
                        old_start: 0,
                        old_lines: 0,
                        new_start: 1,
                        new_lines: lines.len(),
                        lines: diff_lines,
                        is_new_file: true,
                    };

                    Ok(vec![hunk])
                }
            }
        }
        Err(_) => {
            // El archivo no existe en este commit, podría ser un archivo eliminado
            // Verificar si existe en el commit padre
            let parent_show_output = Command::new("git")
                .arg("-C")
                .arg(&path)
                .arg("show")
                .arg(format!("{}^:./{}", sha, file_path))
                .output();

            match parent_show_output {
                Ok(output) => {
                    // El archivo existe en el padre pero no en este commit, está eliminado
                    let file_content = String::from_utf8_lossy(&output.stdout);
                    let lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

                    let diff_lines: Vec<DiffLine> = lines
                        .iter()
                        .enumerate()
                        .map(|(i, line)| DiffLine {
                            kind: DiffLineKind::Del,
                            content: line.clone(),
                            old_lineno: Some(i + 1),
                            new_lineno: None,
                        })
                        .collect();

                    let hunk = DiffHunk {
                        header: format!("@@ -1,{} +0,0 @@", lines.len()),
                        old_start: 1,
                        old_lines: lines.len(),
                        new_start: 0,
                        new_lines: 0,
                        lines: diff_lines,
                        is_new_file: false,
                    };

                    Ok(vec![hunk])
                }
                Err(_) => {
                    // El archivo no existe en ningún commit
                    Ok(vec![])
                }
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileChangeWithHunks {
    pub path: String,
    pub status: ChangeType,
    pub insertions: u32,
    pub deletions: u32,
    pub hunks: Vec<DiffHunk>,
}

#[tauri::command]
pub fn get_working_directory_changes(path: String) -> Result<Vec<FileChangeWithHunks>, String> {
    // println!(
    //     "Rust: get_working_directory_changes called with path: {}",
    //     path
    // );
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let mut changes = Vec::new();

    // Obtener el estado del working directory
    let mut opts = StatusOptions::new();
    opts.include_ignored(false)
        .include_untracked(true)
        .recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    for entry in statuses.iter() {
        let status = entry.status();
        let file_path = entry.path().unwrap_or("").to_string();

        // println!("Rust: status entry: {:?} path: {}", status, file_path);

        if file_path.is_empty() {
            continue;
        }

        // Determinar el tipo de cambio basado en el status
        let change_type = if status.is_wt_new() {
            ChangeType::Added
        } else if status.is_wt_deleted() {
            ChangeType::Deleted
        } else if status.is_wt_modified() {
            ChangeType::Modified
        } else if status.is_wt_renamed() {
            ChangeType::Renamed
        } else if status.is_wt_typechange() {
            ChangeType::TypeChanged
        } else if status.is_index_new() {
            ChangeType::Added
        } else if status.is_index_deleted() {
            ChangeType::Deleted
        } else if status.is_index_modified() {
            ChangeType::Modified
        } else if status.is_index_renamed() {
            ChangeType::Renamed
        } else if status.is_index_typechange() {
            ChangeType::TypeChanged
        } else {
            ChangeType::Modified // Default
        };

        // Calcular insertions y deletions usando git diff --numstat
        use std::process::Command;
        let output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("diff")
            .arg("--numstat")
            .arg("--")
            .arg(&file_path)
            .output();

        let (insertions, deletions) = if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Busca la línea correspondiente al archivo
            let line = stdout.lines().find(|l| l.contains(&file_path));
            if let Some(line) = line {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    (
                        parts[0].parse::<u32>().unwrap_or(0),
                        parts[1].parse::<u32>().unwrap_or(0),
                    )
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        // Obtener los hunks para este archivo
        let hunks = match get_file_diff_hunks(path.clone(), file_path.clone(), 3) {
            Ok(h) => h,
            Err(_) => vec![],
        };

        // println!(
        //     "Rust: Detected file change: {} {:?} +{} -{} ({} hunks)",
        //     file_path,
        //     change_type,
        //     insertions,
        //     deletions,
        //     hunks.len()
        // );

        changes.push(FileChangeWithHunks {
            path: file_path,
            status: change_type,
            insertions,
            deletions,
            hunks,
        });
    }

    // println!("Rust: Total changes detected: {}", changes.len());
    Ok(changes)
}

#[tauri::command]
pub fn git_add_file(path: String, file_path: String) -> Result<(), String> {
    use std::process::Command;
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("add")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "git add failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn git_stage_lines(
    path: String,
    file_path: String,
    hunks: serde_json::Value,
) -> Result<(), String> {
    use std::process::Command;

    // 1. Obtener el diff completo del archivo
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;
    let diff = String::from_utf8_lossy(&output.stdout);

    // 2. Parsear el diff en hunks y líneas
    let parsed_hunks = parse_unified_diff(&diff); // Usa tu función existente

    // 3. Logs detallados para depuración
    let mut all_lines_selected = true;
    for (hunk_idx, hunk) in parsed_hunks.iter().enumerate() {
        let stageable_lines: Vec<usize> = hunk
            .lines
            .iter()
            .enumerate()
            .filter(|(_, line)| matches!(line.kind, DiffLineKind::Add | DiffLineKind::Del))
            .map(|(idx, _)| idx)
            .collect();

        let selected: Vec<usize> = hunks
            .get(hunk_idx.to_string())
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_u64().map(|n| n as usize))
                    .collect()
            })
            .unwrap_or_else(Vec::new);

        println!(
            "[git_stage_lines] Hunk {}: stageable_lines={:?} selected={:?}",
            hunk_idx, stageable_lines, selected
        );
        let all_selected = stageable_lines.iter().all(|l| selected.contains(l));
        println!(
            "[git_stage_lines] Hunk {}: All stageable selected? {}",
            hunk_idx, all_selected
        );
        if !all_selected {
            all_lines_selected = false;
        }
    }

    // ... el resto de tu lógica aquí ...
    println!(
        "[git_stage_lines] all_lines_selected (para todos los hunks): {}",
        all_lines_selected
    );

    if all_lines_selected {
        println!("[git_stage_lines] Ejecutando git add para {}", file_path);
        let status = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("add")
            .arg(&file_path)
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("git add failed".to_string());
        }
        return Ok(());
    }

    // TODO: Implementar stage parcial real o git add si corresponde
    Ok(())
}

#[tauri::command]
pub fn git_commit(path: String, message: String, amend: bool) -> Result<(), String> {
    use std::process::Command;
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(&path).arg("commit");
    if amend {
        cmd.arg("--amend");
    }
    cmd.arg("-m").arg(&message);
    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "git commit failed (code: {:?}):\nstdout: {}\nstderr: {}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<(), String> {
    use std::process::Command;
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("push")
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "git push failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
