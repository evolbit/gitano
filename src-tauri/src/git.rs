use git2::{BranchType, Oid, Repository};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
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
    let patterns = [
        "Merge branch '",
        "Merge remote-tracking branch '",
        "Merge tag '",
    ];
    for pattern in patterns.iter() {
        if let Some(start) = message.find(pattern) {
            let start = start + pattern.len();
            if let Some(end) = message[start..].find("'") {
                return Some(message[start..start + end].to_string());
            }
        }
    }
    None
}

fn build_commit_branch_map(repo: &Repository) -> Result<HashMap<Oid, String>, git2::Error> {
    let mut commit_branch_map = HashMap::new();
    let mut branches_with_priority = Vec::new();

    let develop_branch_tip = repo
        .find_branch("develop", BranchType::Local)
        .and_then(|b| {
            b.get()
                .target()
                .ok_or(git2::Error::from_str("No target for develop branch"))
        })
        .or_else(|_| {
            repo.find_branch("origin/develop", BranchType::Remote)
                .and_then(|b| {
                    b.get()
                        .target()
                        .ok_or(git2::Error::from_str("No target for origin/develop branch"))
                })
        })
        .ok();

    let main_branch_tip = repo
        .find_branch("main", BranchType::Local)
        .and_then(|b| {
            b.get()
                .target()
                .ok_or(git2::Error::from_str("No target for main branch"))
        })
        .or_else(|_| {
            repo.find_branch("origin/main", BranchType::Remote)
                .and_then(|b| {
                    b.get()
                        .target()
                        .ok_or(git2::Error::from_str("No target for origin/main branch"))
                })
        })
        .or_else(|_| {
            repo.find_branch("master", BranchType::Local).and_then(|b| {
                b.get()
                    .target()
                    .ok_or(git2::Error::from_str("No target for master branch"))
            })
        })
        .or_else(|_| {
            repo.find_branch("origin/master", BranchType::Remote)
                .and_then(|b| {
                    b.get()
                        .target()
                        .ok_or(git2::Error::from_str("No target for origin/master branch"))
                })
        })
        .ok();

    for branch_res in repo.branches(None)? {
        let (branch, branch_type) = branch_res?;
        if let Some(branch_name_full) = branch.name()?.map(|s| s.to_string()) {
            let branch_name_short = (if branch_type == BranchType::Remote {
                branch_name_full.splitn(2, '/').last().unwrap_or("")
            } else {
                &branch_name_full
            })
            .to_string();

            if branch_name_short == "develop" || branch_name_short == "main" {
                continue;
            }

            let priority = if branch_name_short.starts_with("feature/")
                || branch_name_short.starts_with("release/")
                || branch_name_short.starts_with("hotfix/")
                || branch_name_short.starts_with("bugfix/")
            {
                1
            } else {
                0
            };
            branches_with_priority.push((branch, branch_name_full, branch_name_short, priority));
        }
    }
    branches_with_priority.sort_by_key(|k| std::cmp::Reverse(k.3));

    for (branch, branch_name_full, branch_name_short, _priority) in branches_with_priority {
        if let Some(branch_tip) = branch.get().target() {
            let base_tip_opt = if branch_name_short.starts_with("release/")
                || branch_name_short.starts_with("hotfix/")
            {
                main_branch_tip
            } else {
                develop_branch_tip
            };

            if let Some(base_tip) = base_tip_opt {
                if branch_tip == base_tip {
                    continue;
                }
                if let Ok(merge_base) = repo.merge_base(branch_tip, base_tip) {
                    let mut revwalk = repo.revwalk()?;
                    revwalk.push(branch_tip)?;
                    revwalk.hide(merge_base)?;

                    for oid_res in revwalk {
                        if let Ok(oid) = oid_res {
                            commit_branch_map
                                .entry(oid)
                                .or_insert_with(|| branch_name_full.clone());
                        }
                    }
                }
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
    let branch_tips = get_all_branch_tips(&repo).map_err(|e| e.to_string())?;
    let commit_branch_map = build_commit_branch_map(&repo).map_err(|e| e.to_string())?;

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
