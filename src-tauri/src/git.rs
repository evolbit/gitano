use git2::{Oid, Repository};
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
