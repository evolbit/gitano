use git2::{BranchType, Repository};
use tauri::command;

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
    let branch_iter = repo
        .branches(Some(BranchType::Local))
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
pub fn get_tags(path: String) -> Result<Vec<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let tag_names = repo.tag_names(None).map_err(|e| e.to_string())?;
    let mut tags: Vec<String> = tag_names
        .iter()
        .flatten()
        .map(ToString::to_string)
        .collect();
    tags.sort();
    Ok(tags)
}

#[command]
pub fn get_remote_url(path: String, remote_name: Option<String>) -> Result<Option<String>, String> {
    let repo = Repository::open(&path).map_err(|e| e.to_string())?;
    let remote_name = remote_name.unwrap_or_else(|| "origin".to_string());
    let remote = match repo.find_remote(&remote_name) {
        Ok(remote) => remote,
        Err(_) => return Ok(None),
    };

    Ok(remote.url().map(ToString::to_string))
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
