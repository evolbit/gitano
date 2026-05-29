import type {
  ExternalAiRunEvent,
  LocalAiRunProgress,
  LocalAiRunResult,
} from "@/shared/api/local-ai";
import type { CommitListItem } from "@/shared/types/git";
import type { CommitCompareMode } from "../components/commit-list/components/commit-compare-modal/commit-compare-modal";

export type LoadCommitsOptions = {
  forceRefresh?: boolean;
  resetScroll?: boolean;
};

export type CommitTableRow = {
  id: string;
  graphWidth: number;
  graphLane: number;
  graphColor: number;
  graphSegments: CommitListItem["graph_segments"];
  refs: string[];
  message: string;
  date: number;
  author: string;
  authorInitial: string;
  authorAvatarUrl?: string | null;
  sha: string;
  rowIndex?: number;
  isPlaceholder?: boolean;
  commit: CommitListItem;
};

export type CommitContextMenuState = {
  row: CommitTableRow;
  x: number;
  y: number;
};

export type CommitCompareState = {
  mode: CommitCompareMode;
  commit: CommitListItem;
};

export type CommitAiAnalysisState = {
  commit: CommitListItem;
  result: LocalAiRunResult | null;
  loading: boolean;
  error: string | null;
  setupOpen: boolean;
  progressRunId: string | null;
  progress: LocalAiRunProgress[];
  externalEvents: ExternalAiRunEvent[];
};

export type CommitDialogState = {
  kind: "branch" | "tag" | "worktree" | "cherryPick" | "revert";
  commit: CommitListItem;
};
