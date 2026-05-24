mod metadata;
mod parser;

use self::metadata::{author_initial, gravatar_avatar_url};
pub(super) use self::parser::{parse_raw_commit_rows, RawCommitRow};
use crate::git::types::*;
use std::collections::HashMap;
use std::ops::Range;

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
const DESIRED_CURVE_HEIGHT: f32 = 1.0 / 3.0;
const DESIRED_CURVE_WIDTH: f32 = 1.0 / 3.0;
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

        match segments.last().copied() {
            Some(ZedCommitLineSegment::Straight { to_row }) if to_row == usize::MAX => {
                finish_unbounded_straight(
                    &mut segments,
                    starting_row,
                    ending_row,
                    lane_column,
                    final_destination,
                );
            }
            Some(ZedCommitLineSegment::Curve {
                on_row, curve_kind, ..
            }) if on_row == usize::MAX => {
                finish_unbounded_curve(
                    &mut segments,
                    curve_kind,
                    starting_row,
                    ending_row,
                    final_destination,
                );
            }
            Some(ZedCommitLineSegment::Curve {
                on_row, to_column, ..
            }) => {
                finish_curve_to_destination(
                    &mut segments,
                    on_row,
                    to_column,
                    ending_row,
                    final_destination,
                );
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

fn finish_unbounded_straight(
    segments: &mut Vec<ZedCommitLineSegment>,
    starting_row: usize,
    ending_row: usize,
    lane_column: usize,
    final_destination: usize,
) {
    if final_destination == lane_column {
        if let Some(ZedCommitLineSegment::Straight { to_row }) = segments.last_mut() {
            *to_row = ending_row;
        }
        return;
    }

    let straight_end_row = ending_row.saturating_sub(1);
    if let Some(ZedCommitLineSegment::Straight { to_row }) = segments.last_mut() {
        *to_row = straight_end_row;
    }

    let checkout_curve = checkout_curve(final_destination, ending_row);
    if straight_end_row == starting_row {
        let last_index = segments.len() - 1;
        segments[last_index] = checkout_curve;
    } else {
        segments.push(checkout_curve);
    }
}

fn finish_unbounded_curve(
    segments: &mut Vec<ZedCommitLineSegment>,
    curve_kind: CurveKind,
    starting_row: usize,
    ending_row: usize,
    final_destination: usize,
) {
    let curve_to_column = {
        let Some(ZedCommitLineSegment::Curve {
            on_row, to_column, ..
        }) = segments.last_mut()
        else {
            return;
        };

        if *to_column == usize::MAX {
            *to_column = final_destination;
        }

        match curve_kind {
            CurveKind::Merge => *on_row = starting_row + 1,
            CurveKind::Checkout => *on_row = ending_row,
        }

        *to_column
    };

    match curve_kind {
        CurveKind::Merge => {
            finish_curve_to_destination(
                segments,
                starting_row + 1,
                curve_to_column,
                ending_row,
                final_destination,
            );
        }
        CurveKind::Checkout => {
            if curve_to_column != final_destination {
                segments.push(ZedCommitLineSegment::Straight { to_row: ending_row });
                segments.push(checkout_curve(final_destination, ending_row));
            }
        }
    }
}

fn finish_curve_to_destination(
    segments: &mut Vec<ZedCommitLineSegment>,
    on_row: usize,
    to_column: usize,
    ending_row: usize,
    final_destination: usize,
) {
    if on_row < ending_row {
        if to_column != final_destination {
            segments.push(ZedCommitLineSegment::Straight {
                to_row: ending_row.saturating_sub(1),
            });
            segments.push(checkout_curve(final_destination, ending_row));
        } else {
            segments.push(ZedCommitLineSegment::Straight { to_row: ending_row });
        }
    } else if to_column != final_destination {
        segments.push(checkout_curve(final_destination, ending_row));
    }
}

fn checkout_curve(to_column: usize, on_row: usize) -> ZedCommitLineSegment {
    ZedCommitLineSegment::Curve {
        to_column,
        on_row,
        curve_kind: CurveKind::Checkout,
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

pub(super) fn build_zed_style_commit_rows(raw_commits: Vec<RawCommitRow>) -> Vec<CommitListItem> {
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
                graph_width,
                graph_lane: entry.lane,
                graph_color: entry.color_idx,
                graph_segments: row_segments.get(row_idx).cloned().unwrap_or_default(),
                refs: raw.refs,
                message: raw.message,
                author_initial: author_initial(&raw.author),
                author_avatar_url: gravatar_avatar_url(&raw.author_email),
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
                let (next_lane, next_row) = append_curve_segments(
                    row_segments,
                    line.color_idx,
                    current_lane,
                    current_row,
                    *to_column as f32,
                    *on_row as f32 + 0.5,
                    *curve_kind,
                    is_last,
                );

                current_row = next_row;
                current_lane = next_lane;
            }
        }
    }
}

fn append_curve_segments(
    row_segments: &mut [Vec<CommitGraphSegment>],
    color_idx: usize,
    current_lane: f32,
    current_row: f32,
    to_lane: f32,
    to_row: f32,
    curve_kind: CurveKind,
    is_last: bool,
) -> (f32, f32) {
    match curve_kind {
        CurveKind::Checkout => append_checkout_curve_segments(
            row_segments,
            color_idx,
            current_lane,
            current_row,
            to_lane,
            to_row,
            is_last,
        ),
        CurveKind::Merge => append_merge_curve_segments(
            row_segments,
            color_idx,
            current_lane,
            current_row,
            to_lane,
            to_row,
            is_last,
        ),
    }
}

fn append_checkout_curve_segments(
    row_segments: &mut [Vec<CommitGraphSegment>],
    color_idx: usize,
    current_lane: f32,
    current_row: f32,
    mut to_lane: f32,
    to_row: f32,
    is_last: bool,
) -> (f32, f32) {
    let going_right = to_lane > current_lane;
    let column_shift = curve_column_shift(going_right);

    if is_last {
        to_lane -= column_shift;
    }

    let curve_width = DESIRED_CURVE_WIDTH.min((to_lane - current_lane).abs());
    let curve_height = DESIRED_CURVE_HEIGHT.min((to_row - current_row).abs());
    let signed_curve_width = signed_curve_width(curve_width, going_right);
    let curve_start_y = to_row - curve_height;
    let curve_end_lane = current_lane + signed_curve_width;

    push_vertical_segments(
        row_segments,
        color_idx,
        current_lane,
        current_row,
        curve_start_y,
    );
    push_curve_segment(
        row_segments,
        color_idx,
        current_lane,
        curve_start_y,
        curve_end_lane,
        to_row,
        current_lane,
        to_row,
    );
    push_line_segment(
        row_segments,
        color_idx,
        curve_end_lane,
        to_row,
        to_lane,
        to_row,
    );

    (to_lane, to_row)
}

fn append_merge_curve_segments(
    row_segments: &mut [Vec<CommitGraphSegment>],
    color_idx: usize,
    current_lane: f32,
    current_row: f32,
    to_lane: f32,
    mut to_row: f32,
    is_last: bool,
) -> (f32, f32) {
    let radius_row = ZED_COMMIT_CIRCLE_RADIUS / COMMIT_GRAPH_ROW_HEIGHT;
    let going_right = to_lane > current_lane;
    let column_shift = curve_column_shift(going_right);

    if is_last {
        to_row -= radius_row;
    }

    let merge_start_lane = current_lane + column_shift;
    let merge_start_y = current_row - radius_row;
    let curve_width = DESIRED_CURVE_WIDTH.min((to_lane - merge_start_lane).abs());
    let curve_height = DESIRED_CURVE_HEIGHT.min((to_row - merge_start_y).abs());
    let signed_curve_width = signed_curve_width(curve_width, going_right);
    let curve_start_lane = to_lane - signed_curve_width;
    let curve_end_y = merge_start_y + curve_height;

    push_line_segment(
        row_segments,
        color_idx,
        merge_start_lane,
        merge_start_y,
        curve_start_lane,
        merge_start_y,
    );
    push_curve_segment(
        row_segments,
        color_idx,
        curve_start_lane,
        merge_start_y,
        to_lane,
        curve_end_y,
        to_lane,
        merge_start_y,
    );
    push_vertical_segments(row_segments, color_idx, to_lane, curve_end_y, to_row);

    (to_lane, to_row)
}

fn curve_column_shift(going_right: bool) -> f32 {
    let radius_lane = (ZED_COMMIT_CIRCLE_RADIUS + ZED_COMMIT_CIRCLE_STROKE_WIDTH) / ZED_LANE_WIDTH;
    if going_right {
        radius_lane
    } else {
        -radius_lane
    }
}

fn signed_curve_width(curve_width: f32, going_right: bool) -> f32 {
    if going_right {
        curve_width
    } else {
        -curve_width
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

#[cfg(test)]
mod tests {
    use super::*;

    mod build_zed_style_commit_rows {
        use super::*;

        #[test]
        fn assigns_minimum_graph_width_and_author_metadata() {
            let rows = build_zed_style_commit_rows(vec![RawCommitRow {
                sha: "child".to_string(),
                parents: vec!["parent".to_string()],
                date: 10,
                author: "Ada Lovelace".to_string(),
                author_email: "ada@example.invalid".to_string(),
                refs: vec!["main".to_string()],
                message: "Ship it".to_string(),
            }]);

            assert_eq!(rows.len(), 1);
            assert_eq!(rows[0].graph_width, MIN_GRAPH_LANES);
            assert_eq!(rows[0].author_initial, "A");
            assert!(rows[0].author_avatar_url.is_some());
        }
    }
}
