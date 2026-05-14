use crate::git::types::*;
use git2::{BranchType, Oid, Repository};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::ops::Range;
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

static COMMIT_LIST_CACHE: Lazy<Mutex<HashMap<String, Vec<CommitListItem>>>> =
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

    // heads: names of local branches that point to each commit
    for reference in repo.references().map_err(|e| e.to_string())? {
        if let Ok(reference) = reference {
            let name = reference.name().unwrap_or("");
            if name.starts_with("refs/heads/") {
                if let Some(target) = reference.target() {
                    if let Some(&index) = commit_lookup.get(&target.to_string()) {
                        // Extract the branch name after 'refs/heads/'
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

    // REMOTES: annotate remotes on the commits
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

    // Uncommitted Changes: if there are uncommitted changes, add a special commit
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
    history_mode: Option<CommitHistoryMode>,
    offset: usize,
    limit: usize,
) -> Result<CommitListPage, String> {
    // Intentionally ignored: commit list uses git --all style history.
    let _ = branch;
    let history_mode = history_mode.unwrap_or(CommitHistoryMode::GitLog);
    let cache_key = format!("{}::{:?}", path, history_mode);

    let mut cache = COMMIT_LIST_CACHE.lock().unwrap();
    if offset == 0 || !cache.contains_key(&cache_key) {
        let all_commits = collect_commit_rows_with_graph(&path, history_mode)?;
        let repo_prefix = format!("{}::", path);
        cache.retain(|k, _| !k.starts_with(&repo_prefix));
        cache.insert(cache_key.clone(), all_commits);
    }
    let all_commits = cache.get(&cache_key).cloned().unwrap_or_default();
    drop(cache);

    if all_commits.is_empty() || offset >= all_commits.len() {
        return Ok(CommitListPage {
            commits: Vec::new(),
            has_more: false,
        });
    }

    let safe_limit = if limit == 0 { 50 } else { limit };
    let end = offset.saturating_add(safe_limit).min(all_commits.len());
    let has_more = end < all_commits.len();
    let commits = all_commits[offset..end].to_vec();

    Ok(CommitListPage { commits, has_more })
}

fn collect_commit_rows_with_graph(
    path: &str,
    history_mode: CommitHistoryMode,
) -> Result<Vec<CommitListItem>, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(path)
        .arg("log")
        .arg("--all")
        .arg("--date-order")
        .arg("--color=never")
        .arg("--no-abbrev-commit")
        .arg("--pretty=format:%H%x1f%P%x1f%at%x1f%an%x1f%s");

    if history_mode == CommitHistoryMode::FirstParent {
        cmd.arg("--first-parent");
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Failed to run git log command".to_string()
        } else {
            stderr
        });
    }

    let raw_commits = parse_raw_commit_rows(&String::from_utf8_lossy(&output.stdout));
    Ok(build_zed_style_commit_rows(raw_commits))
}

#[derive(Clone)]
struct RawCommitRow {
    sha: String,
    parents: Vec<String>,
    date: i64,
    author: String,
    message: String,
}

#[derive(Clone)]
enum LaneState {
    Empty,
    Active {
        color: Option<usize>,
        starting_row: usize,
        starting_col: usize,
        destination_column: Option<usize>,
        segments: Vec<ZedCommitLineSegment>,
    },
}

#[derive(Clone, Copy)]
enum CurveKind {
    Merge,
    Checkout,
}

#[derive(Clone, Copy)]
enum ZedCommitLineSegment {
    Straight {
        to_row: usize,
    },
    Curve {
        to_column: usize,
        on_row: usize,
        curve_kind: CurveKind,
    },
}

#[derive(Clone)]
struct ZedCommitLine {
    child_column: usize,
    full_interval: Range<usize>,
    color_idx: usize,
    segments: Vec<ZedCommitLineSegment>,
}

#[derive(Clone, Copy)]
struct ZedCommitEntry {
    lane: usize,
    color_idx: usize,
}

struct ZedGraphData {
    lane_states: Vec<LaneState>,
    lane_colors: HashMap<usize, usize>,
    parent_to_lanes: HashMap<String, Vec<usize>>,
    next_color: usize,
    commits: Vec<ZedCommitEntry>,
    lines: Vec<ZedCommitLine>,
    max_lanes: usize,
}

const GRAPH_ACCENT_COUNT: usize = 10;
const ZED_LANE_WIDTH: f32 = 16.0;
const ZED_COMMIT_CIRCLE_RADIUS: f32 = 3.5;
const ZED_COMMIT_CIRCLE_STROKE_WIDTH: f32 = 1.5;
const COMMIT_GRAPH_ROW_HEIGHT: f32 = 30.0;
const MIN_GRAPH_LANES: usize = 6;

impl LaneState {
    fn is_empty(&self) -> bool {
        matches!(self, LaneState::Empty)
    }

    fn to_commit_line(
        &mut self,
        ending_row: usize,
        lane_column: usize,
        parent_column: usize,
        parent_color: usize,
    ) -> Option<ZedCommitLine> {
        let state = std::mem::replace(self, LaneState::Empty);

        let LaneState::Active {
            color,
            starting_row,
            starting_col,
            destination_column,
            mut segments,
            ..
        } = state
        else {
            return None;
        };

        let final_destination = destination_column.unwrap_or(parent_column);
        let final_color = color.unwrap_or(parent_color);

        match segments.last_mut() {
            Some(ZedCommitLineSegment::Straight { to_row }) if *to_row == usize::MAX => {
                if final_destination != lane_column {
                    *to_row = ending_row.saturating_sub(1);

                    let curved_line = ZedCommitLineSegment::Curve {
                        to_column: final_destination,
                        on_row: ending_row,
                        curve_kind: CurveKind::Checkout,
                    };

                    if *to_row == starting_row {
                        let last_index = segments.len() - 1;
                        segments[last_index] = curved_line;
                    } else {
                        segments.push(curved_line);
                    }
                } else {
                    *to_row = ending_row;
                }
            }
            Some(ZedCommitLineSegment::Curve {
                on_row,
                to_column,
                curve_kind,
            }) if *on_row == usize::MAX => {
                if *to_column == usize::MAX {
                    *to_column = final_destination;
                }

                if matches!(curve_kind, CurveKind::Merge) {
                    *on_row = starting_row + 1;
                    if *on_row < ending_row {
                        if *to_column != final_destination {
                            segments.push(ZedCommitLineSegment::Straight {
                                to_row: ending_row.saturating_sub(1),
                            });
                            segments.push(ZedCommitLineSegment::Curve {
                                to_column: final_destination,
                                on_row: ending_row,
                                curve_kind: CurveKind::Checkout,
                            });
                        } else {
                            segments.push(ZedCommitLineSegment::Straight { to_row: ending_row });
                        }
                    } else if *to_column != final_destination {
                        segments.push(ZedCommitLineSegment::Curve {
                            to_column: final_destination,
                            on_row: ending_row,
                            curve_kind: CurveKind::Checkout,
                        });
                    }
                } else {
                    *on_row = ending_row;
                    if *to_column != final_destination {
                        segments.push(ZedCommitLineSegment::Straight { to_row: ending_row });
                        segments.push(ZedCommitLineSegment::Curve {
                            to_column: final_destination,
                            on_row: ending_row,
                            curve_kind: CurveKind::Checkout,
                        });
                    }
                }
            }
            Some(ZedCommitLineSegment::Curve {
                on_row, to_column, ..
            }) => {
                if *on_row < ending_row {
                    if *to_column != final_destination {
                        segments.push(ZedCommitLineSegment::Straight {
                            to_row: ending_row.saturating_sub(1),
                        });
                        segments.push(ZedCommitLineSegment::Curve {
                            to_column: final_destination,
                            on_row: ending_row,
                            curve_kind: CurveKind::Checkout,
                        });
                    } else {
                        segments.push(ZedCommitLineSegment::Straight { to_row: ending_row });
                    }
                } else if *to_column != final_destination {
                    segments.push(ZedCommitLineSegment::Curve {
                        to_column: final_destination,
                        on_row: ending_row,
                        curve_kind: CurveKind::Checkout,
                    });
                }
            }
            _ => {}
        }

        Some(ZedCommitLine {
            child_column: starting_col,
            full_interval: starting_row..ending_row,
            color_idx: final_color,
            segments,
        })
    }
}

impl ZedGraphData {
    fn new() -> Self {
        Self {
            lane_states: Vec::new(),
            lane_colors: HashMap::new(),
            parent_to_lanes: HashMap::new(),
            next_color: 0,
            commits: Vec::new(),
            lines: Vec::new(),
            max_lanes: 0,
        }
    }

    fn first_empty_lane_idx(&mut self) -> usize {
        self.lane_states
            .iter()
            .position(LaneState::is_empty)
            .unwrap_or_else(|| {
                self.lane_states.push(LaneState::Empty);
                self.lane_states.len() - 1
            })
    }

    fn get_lane_color(&mut self, lane_idx: usize) -> usize {
        *self.lane_colors.entry(lane_idx).or_insert_with(|| {
            let color_idx = self.next_color;
            self.next_color = (self.next_color + 1) % GRAPH_ACCENT_COUNT;
            color_idx
        })
    }

    fn add_commits(&mut self, commits: &[RawCommitRow]) {
        self.commits.reserve(commits.len());
        self.lines.reserve(commits.len() / 2);

        for commit in commits {
            let commit_row = self.commits.len();
            let commit_lane = self
                .parent_to_lanes
                .get(&commit.sha)
                .and_then(|lanes| lanes.iter().min().copied())
                .unwrap_or_else(|| self.first_empty_lane_idx());
            let commit_color = self.get_lane_color(commit_lane);

            if let Some(lanes) = self.parent_to_lanes.remove(&commit.sha) {
                for lane_column in lanes {
                    self.adjust_merge_destination(lane_column, commit_lane, commit_row);
                    if let Some(commit_line) = self.lane_states[lane_column].to_commit_line(
                        commit_row,
                        lane_column,
                        commit_lane,
                        commit_color,
                    ) {
                        self.lines.push(commit_line);
                    }
                }
            }

            for (parent_idx, parent) in commit.parents.iter().enumerate() {
                if parent_idx == 0 {
                    self.lane_states[commit_lane] = LaneState::Active {
                        color: Some(commit_color),
                        starting_col: commit_lane,
                        starting_row: commit_row,
                        destination_column: None,
                        segments: vec![ZedCommitLineSegment::Straight { to_row: usize::MAX }],
                    };

                    self.parent_to_lanes
                        .entry(parent.clone())
                        .or_default()
                        .push(commit_lane);
                } else {
                    let new_lane = self.first_empty_lane_idx();

                    self.lane_states[new_lane] = LaneState::Active {
                        color: None,
                        starting_col: commit_lane,
                        starting_row: commit_row,
                        destination_column: None,
                        segments: vec![ZedCommitLineSegment::Curve {
                            to_column: usize::MAX,
                            on_row: usize::MAX,
                            curve_kind: CurveKind::Merge,
                        }],
                    };

                    self.parent_to_lanes
                        .entry(parent.clone())
                        .or_default()
                        .push(new_lane);
                }
            }

            self.max_lanes = self.max_lanes.max(self.lane_states.len());
            self.commits.push(ZedCommitEntry {
                lane: commit_lane,
                color_idx: commit_color,
            });
        }
    }

    fn adjust_merge_destination(
        &mut self,
        lane_column: usize,
        commit_lane: usize,
        commit_row: usize,
    ) {
        let Some(LaneState::Active {
            starting_row,
            segments,
            ..
        }) = self.lane_states.get(lane_column)
        else {
            return;
        };

        let Some(ZedCommitLineSegment::Curve {
            curve_kind: CurveKind::Merge,
            ..
        }) = segments.first()
        else {
            return;
        };

        let curve_row = starting_row + 1;
        let would_overlap = lane_column != commit_lane
            && curve_row < commit_row
            && self.commits[curve_row..commit_row]
                .iter()
                .any(|commit| commit.lane == commit_lane);

        if !would_overlap {
            return;
        }

        if let LaneState::Active { segments, .. } = &mut self.lane_states[lane_column] {
            if let Some(ZedCommitLineSegment::Curve { to_column, .. }) = segments.first_mut() {
                *to_column = lane_column;
            }
        }
    }
}

fn parse_raw_commit_rows(stdout: &str) -> Vec<RawCommitRow> {
    stdout
        .lines()
        .filter_map(|raw_line| {
            let line = raw_line.trim_end_matches('\r');
            if line.trim().is_empty() {
                return None;
            }

            let mut fields = line.splitn(5, '\u{001f}');
            let sha = fields.next().unwrap_or("").trim().to_string();
            if sha.is_empty() {
                return None;
            }

            let parents = fields
                .next()
                .unwrap_or("")
                .split_whitespace()
                .map(|parent| parent.to_string())
                .collect::<Vec<_>>();
            let date = fields
                .next()
                .unwrap_or("0")
                .trim()
                .parse::<i64>()
                .unwrap_or(0);
            let author = fields.next().unwrap_or("").to_string();
            let message = fields.next().unwrap_or("").to_string();

            Some(RawCommitRow {
                sha,
                parents,
                date,
                author,
                message,
            })
        })
        .collect()
}

fn build_zed_style_commit_rows(raw_commits: Vec<RawCommitRow>) -> Vec<CommitListItem> {
    let mut graph_data = ZedGraphData::new();
    graph_data.add_commits(&raw_commits);

    let graph_width = graph_data.max_lanes.max(MIN_GRAPH_LANES);
    let mut row_segments: Vec<Vec<CommitGraphSegment>> = vec![Vec::new(); raw_commits.len()];
    for line in &graph_data.lines {
        append_line_segments(line, &mut row_segments);
    }

    raw_commits
        .into_iter()
        .enumerate()
        .map(|(row_idx, raw)| {
            let entry = graph_data
                .commits
                .get(row_idx)
                .copied()
                .unwrap_or(ZedCommitEntry {
                    lane: 0,
                    color_idx: 0,
                });

            CommitListItem {
                sha: raw.sha,
                parents: raw.parents,
                graph: Vec::new(),
                graph_joins: Vec::new(),
                graph_node_up: false,
                graph_node_down: false,
                graph_extra: Vec::new(),
                graph_width,
                graph_lane: entry.lane,
                graph_color: entry.color_idx,
                graph_segments: row_segments.get(row_idx).cloned().unwrap_or_default(),
                message: raw.message,
                author: raw.author,
                date: raw.date,
                current_branch: String::new(),
                source_branch: String::new(),
                commit_history: Vec::new(),
                files: 0,
            }
        })
        .collect()
}

fn append_line_segments(line: &ZedCommitLine, row_segments: &mut [Vec<CommitGraphSegment>]) {
    let radius_row = ZED_COMMIT_CIRCLE_RADIUS / COMMIT_GRAPH_ROW_HEIGHT;
    let radius_lane = (ZED_COMMIT_CIRCLE_RADIUS + ZED_COMMIT_CIRCLE_STROKE_WIDTH) / ZED_LANE_WIDTH;
    let desired_curve_height: f32 = 1.0 / 3.0;
    let desired_curve_width: f32 = 1.0 / 3.0;

    let mut current_row = line.full_interval.start as f32 + 0.5 + radius_row;
    let mut current_lane = line.child_column as f32;

    for (segment_idx, segment) in line.segments.iter().enumerate() {
        let is_last = segment_idx + 1 == line.segments.len();

        match segment {
            ZedCommitLineSegment::Straight { to_row } => {
                let mut dest_row = *to_row as f32 + 0.5;
                if is_last {
                    dest_row -= radius_row;
                }

                push_vertical_segments(
                    row_segments,
                    line.color_idx,
                    current_lane,
                    current_row,
                    dest_row,
                );
                current_row = dest_row;
            }
            ZedCommitLineSegment::Curve {
                to_column,
                on_row,
                curve_kind,
            } => {
                let mut to_lane = *to_column as f32;
                let mut to_row = *on_row as f32 + 0.5;
                let going_right = to_lane > current_lane;
                let column_shift = if going_right {
                    radius_lane
                } else {
                    -radius_lane
                };

                match curve_kind {
                    CurveKind::Checkout => {
                        if is_last {
                            to_lane -= column_shift;
                        }

                        let available_curve_width = (to_lane - current_lane).abs();
                        let available_curve_height = (to_row - current_row).abs();
                        let curve_width = desired_curve_width.min(available_curve_width);
                        let curve_height = desired_curve_height.min(available_curve_height);
                        let signed_curve_width = if going_right {
                            curve_width
                        } else {
                            -curve_width
                        };
                        let curve_start_y = to_row - curve_height;
                        let curve_end_lane = current_lane + signed_curve_width;

                        push_vertical_segments(
                            row_segments,
                            line.color_idx,
                            current_lane,
                            current_row,
                            curve_start_y,
                        );
                        push_curve_segment(
                            row_segments,
                            line.color_idx,
                            current_lane,
                            curve_start_y,
                            curve_end_lane,
                            to_row,
                            current_lane,
                            to_row,
                        );
                        push_line_segment(
                            row_segments,
                            line.color_idx,
                            curve_end_lane,
                            to_row,
                            to_lane,
                            to_row,
                        );
                    }
                    CurveKind::Merge => {
                        if is_last {
                            to_row -= radius_row;
                        }

                        let merge_start_lane = current_lane + column_shift;
                        let merge_start_y = current_row - radius_row;
                        let available_curve_width = (to_lane - merge_start_lane).abs();
                        let available_curve_height = (to_row - merge_start_y).abs();
                        let curve_width = desired_curve_width.min(available_curve_width);
                        let curve_height = desired_curve_height.min(available_curve_height);
                        let signed_curve_width = if going_right {
                            curve_width
                        } else {
                            -curve_width
                        };
                        let curve_start_lane = to_lane - signed_curve_width;
                        let curve_end_y = merge_start_y + curve_height;

                        push_line_segment(
                            row_segments,
                            line.color_idx,
                            merge_start_lane,
                            merge_start_y,
                            curve_start_lane,
                            merge_start_y,
                        );
                        push_curve_segment(
                            row_segments,
                            line.color_idx,
                            curve_start_lane,
                            merge_start_y,
                            to_lane,
                            curve_end_y,
                            to_lane,
                            merge_start_y,
                        );
                        push_vertical_segments(
                            row_segments,
                            line.color_idx,
                            to_lane,
                            curve_end_y,
                            to_row,
                        );
                    }
                }

                current_row = to_row;
                current_lane = to_lane;
            }
        }
    }
}

fn push_vertical_segments(
    row_segments: &mut [Vec<CommitGraphSegment>],
    color_idx: usize,
    lane: f32,
    from_y: f32,
    to_y: f32,
) {
    if to_y <= from_y {
        return;
    }

    let start_row = from_y.floor() as isize;
    let end_row = (to_y - 0.0001).floor() as isize;

    for row in start_row..=end_row {
        if row < 0 {
            continue;
        }
        let row_index = row as usize;
        if row_index >= row_segments.len() {
            break;
        }

        let local_from = (from_y - row as f32).clamp(0.0, 1.0);
        let local_to = (to_y - row as f32).clamp(0.0, 1.0);
        if local_to <= local_from {
            continue;
        }

        row_segments[row_index].push(CommitGraphSegment {
            color_idx,
            from_lane: lane,
            from_y: local_from,
            to_lane: lane,
            to_y: local_to,
            control_lane: None,
            control_y: None,
        });
    }
}

fn push_line_segment(
    row_segments: &mut [Vec<CommitGraphSegment>],
    color_idx: usize,
    from_lane: f32,
    from_y: f32,
    to_lane: f32,
    to_y: f32,
) {
    let row = from_y.floor() as isize;
    if row < 0 || row as usize >= row_segments.len() {
        return;
    }

    row_segments[row as usize].push(CommitGraphSegment {
        color_idx,
        from_lane,
        from_y: from_y - row as f32,
        to_lane,
        to_y: to_y - row as f32,
        control_lane: None,
        control_y: None,
    });
}

fn push_curve_segment(
    row_segments: &mut [Vec<CommitGraphSegment>],
    color_idx: usize,
    from_lane: f32,
    from_y: f32,
    to_lane: f32,
    to_y: f32,
    control_lane: f32,
    control_y: f32,
) {
    let row = from_y.floor() as isize;
    if row < 0 || row as usize >= row_segments.len() {
        return;
    }

    row_segments[row as usize].push(CommitGraphSegment {
        color_idx,
        from_lane,
        from_y: from_y - row as f32,
        to_lane,
        to_y: to_y - row as f32,
        control_lane: Some(control_lane),
        control_y: Some(control_y - row as f32),
    });
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
