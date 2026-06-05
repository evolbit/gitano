import type { GitConflictAiCandidate } from "@/shared/types/git-conflicts";

export type ConflictAiPanelProps = {
  candidate: GitConflictAiCandidate | null;
  candidateSummary: string | null;
  loading: boolean;
  error: string | null;
  canRunRegion: boolean;
  canRunFile: boolean;
  onRunRegion: () => void;
  onRunFile: () => void;
  onRefreshRegion: () => void;
  onRefreshFile: () => void;
  onApply: () => void;
  onClear: () => void;
};
