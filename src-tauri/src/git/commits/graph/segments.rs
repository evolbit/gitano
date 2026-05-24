use super::{CurveKind, ZedCommitLine, ZedCommitLineSegment};
use crate::git::types::CommitGraphSegment;

const ZED_LANE_WIDTH: f32 = 16.0;
const ZED_COMMIT_CIRCLE_RADIUS: f32 = 3.5;
const ZED_COMMIT_CIRCLE_STROKE_WIDTH: f32 = 1.5;
const COMMIT_GRAPH_ROW_HEIGHT: f32 = 30.0;
const DESIRED_CURVE_HEIGHT: f32 = 1.0 / 3.0;
const DESIRED_CURVE_WIDTH: f32 = 1.0 / 3.0;

pub(super) fn append_line_segments(
    line: &ZedCommitLine,
    row_segments: &mut [Vec<CommitGraphSegment>],
) {
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
