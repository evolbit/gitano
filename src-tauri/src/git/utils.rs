use git2::{BranchType, Oid, Repository};
use std::collections::HashMap;

pub fn get_all_branch_tips(repo: &Repository) -> Result<HashMap<Oid, Vec<String>>, git2::Error> {
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

pub fn get_merge_source_branch(message: &str) -> Option<String> {
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

pub fn get_main_branch_tip(repo: &Repository) -> Result<Option<Oid>, git2::Error> {
    for branch_name in &["main", "master"] {
        if let Ok(branch) = repo.find_branch(branch_name, BranchType::Local) {
            if let Some(tip) = branch.get().target() {
                return Ok(Some(tip));
            }
        }
    }
    Ok(None)
}

pub fn build_commit_branch_map(repo: &Repository) -> Result<HashMap<Oid, String>, git2::Error> {
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
