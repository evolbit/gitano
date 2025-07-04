use crate::git::types::*;
use crate::git::utils::*;
use git2::{BranchType, Oid, Repository};
use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

static COMMIT_BRANCH_MAP_CACHE: Lazy<Mutex<HashMap<String, HashMap<Oid, String>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

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
