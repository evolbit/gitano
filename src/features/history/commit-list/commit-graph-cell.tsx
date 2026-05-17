import type { CommitGraphSegment } from "@/shared/types/git";

// Zed uses theme accent colors for graph lanes. These values mirror the
// default dark theme accents closely enough for direct visual comparison.
const GRAPH_COLORS = [
  "#74ade8",
  "#be5046",
  "#bf956a",
  "#b477cf",
  "#6eb4bf",
  "#d07277",
  "#dec184",
  "#a1c181",
];

const LANE_WIDTH = 16;
const LEFT_PADDING = 12;
const STROKE_WIDTH = 1.5;
const NODE_RADIUS = 3.5;

type CommitGraphCellProps = {
  rowHeight?: number;
  graphWidth?: number;
  lane?: number;
  colorIdx?: number;
  segments?: CommitGraphSegment[];
};

function colorForIndex(index: number): string {
  return GRAPH_COLORS[index % GRAPH_COLORS.length];
}

function xForLane(lane: number): number {
  return LEFT_PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

function yForRowFraction(y: number, rowHeight: number): number {
  return y * rowHeight;
}

export default function CommitGraphCell({
  rowHeight = 40,
  graphWidth,
  lane,
  colorIdx,
  segments = [],
}: CommitGraphCellProps) {
  const laneCount = Math.max(graphWidth ?? 1, 6);
  const width = LEFT_PADDING * 2 + laneCount * LANE_WIDTH;
  const nodeLane = lane ?? 0;
  const nodeColor = colorForIndex(colorIdx ?? Math.max(nodeLane, 0));

  return (
    <div className="h-full w-full overflow-hidden">
      <svg
        width={width}
        height={rowHeight}
        viewBox={`0 0 ${width} ${rowHeight}`}
        preserveAspectRatio="xMinYMid meet">
        {segments.map((segment, index) => {
          const fromX = xForLane(segment.from_lane);
          const fromY = yForRowFraction(segment.from_y, rowHeight);
          const toX = xForLane(segment.to_lane);
          const toY = yForRowFraction(segment.to_y, rowHeight);
          const hasControl =
            segment.control_lane !== null &&
            segment.control_lane !== undefined &&
            segment.control_y !== null &&
            segment.control_y !== undefined;
          const d = hasControl
            ? `M ${fromX} ${fromY} Q ${xForLane(segment.control_lane!)} ${yForRowFraction(
                segment.control_y!,
                rowHeight
              )} ${toX} ${toY}`
            : `M ${fromX} ${fromY} L ${toX} ${toY}`;

          return (
            <path
              key={`${segment.color_idx}-${index}`}
              d={d}
              stroke={colorForIndex(segment.color_idx)}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {nodeLane >= 0 && (
          <circle
            cx={xForLane(nodeLane)}
            cy={rowHeight / 2}
            r={NODE_RADIUS}
            fill={nodeColor}
          />
        )}
      </svg>
    </div>
  );
}
