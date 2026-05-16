export type PaneInitialSize = number | `${number}%`;

type PaneLayoutConfig = {
  min: number;
  initial: PaneInitialSize;
  max?: number;
};

const REPO_LAYOUT_PANES: {
  left: PaneLayoutConfig;
  middle: PaneLayoutConfig;
  right: PaneLayoutConfig;
} = {
  left: {
    min: 300,
    initial: 300,
    max: 350,
  },
  middle: {
    min: 500,
    initial: "60%",
  },
  right: {
    min: 300,
    initial: 300,
  },
};

export const REPO_LAYOUT = {
  panes: REPO_LAYOUT_PANES,
  window: {
    minWidth:
      REPO_LAYOUT_PANES.left.min +
      REPO_LAYOUT_PANES.middle.min +
      REPO_LAYOUT_PANES.right.min,
    minHeight: 600,
    width:
      REPO_LAYOUT_PANES.left.min +
      REPO_LAYOUT_PANES.middle.min +
      REPO_LAYOUT_PANES.right.min,
    height: 600,
  },
} as const;
