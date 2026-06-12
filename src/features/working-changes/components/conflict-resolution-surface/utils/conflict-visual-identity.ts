import type { CSSProperties } from "react";
import {
  GIT_CONFLICT_SIDE,
  type GitConflictSide,
} from "@/shared/types/git-conflicts";

type ConflictPaneStyle = CSSProperties & {
  "--gitano-conflict-accent": string;
  "--gitano-conflict-accent-muted": string;
  "--gitano-conflict-fill": string;
  "--gitano-conflict-fill-active": string;
  "--gitano-conflict-label": string;
  "--gitano-conflict-widget-background": string;
  "--gitano-conflict-zone-background": string;
};

export type ConflictPaneVisualIdentity = {
  side: GitConflictSide;
  label: string;
  overviewRulerColor: string;
  overviewRulerActiveColor: string;
  style: ConflictPaneStyle;
};

export const CONFLICT_PANE_VISUAL_IDENTITY: Partial<
  Record<GitConflictSide, ConflictPaneVisualIdentity>
> = {
  [GIT_CONFLICT_SIDE.Incoming]: {
    side: GIT_CONFLICT_SIDE.Incoming,
    label: "Incoming",
    overviewRulerColor: "rgba(34, 211, 238, 0.5)",
    overviewRulerActiveColor: "rgba(34, 211, 238, 0.9)",
    style: {
      "--gitano-conflict-accent": "rgb(34, 211, 238)",
      "--gitano-conflict-accent-muted": "rgba(34, 211, 238, 0.45)",
      "--gitano-conflict-fill": "rgba(8, 145, 178, 0.2)",
      "--gitano-conflict-fill-active": "rgba(8, 145, 178, 0.32)",
      "--gitano-conflict-label": "rgb(103, 232, 249)",
      "--gitano-conflict-widget-background": "rgba(8, 47, 73, 0.78)",
      "--gitano-conflict-zone-background": "rgba(8, 145, 178, 0.09)",
    },
  },
  [GIT_CONFLICT_SIDE.Current]: {
    side: GIT_CONFLICT_SIDE.Current,
    label: "Current",
    overviewRulerColor: "rgba(245, 158, 11, 0.5)",
    overviewRulerActiveColor: "rgba(245, 158, 11, 0.9)",
    style: {
      "--gitano-conflict-accent": "rgb(245, 158, 11)",
      "--gitano-conflict-accent-muted": "rgba(245, 158, 11, 0.45)",
      "--gitano-conflict-fill": "rgba(120, 83, 18, 0.3)",
      "--gitano-conflict-fill-active": "rgba(146, 64, 14, 0.36)",
      "--gitano-conflict-label": "rgb(252, 211, 77)",
      "--gitano-conflict-widget-background": "rgba(69, 26, 3, 0.78)",
      "--gitano-conflict-zone-background": "rgba(245, 158, 11, 0.08)",
    },
  },
  [GIT_CONFLICT_SIDE.Result]: {
    side: GIT_CONFLICT_SIDE.Result,
    label: "Result",
    overviewRulerColor: "rgba(217, 70, 239, 0.5)",
    overviewRulerActiveColor: "rgba(217, 70, 239, 0.9)",
    style: {
      "--gitano-conflict-accent": "rgb(217, 70, 239)",
      "--gitano-conflict-accent-muted": "rgba(217, 70, 239, 0.45)",
      "--gitano-conflict-fill": "rgba(126, 34, 206, 0.22)",
      "--gitano-conflict-fill-active": "rgba(126, 34, 206, 0.34)",
      "--gitano-conflict-label": "rgb(240, 171, 252)",
      "--gitano-conflict-widget-background": "rgba(46, 16, 101, 0.88)",
      "--gitano-conflict-zone-background": "rgba(217, 70, 239, 0.08)",
    },
  },
};

export function getConflictPaneVisualIdentity(side: GitConflictSide) {
  const fallbackIdentity =
    CONFLICT_PANE_VISUAL_IDENTITY[GIT_CONFLICT_SIDE.Current];

  if (!fallbackIdentity) {
    throw new Error("Missing default conflict pane visual identity.");
  }

  return CONFLICT_PANE_VISUAL_IDENTITY[side] ?? fallbackIdentity;
}
