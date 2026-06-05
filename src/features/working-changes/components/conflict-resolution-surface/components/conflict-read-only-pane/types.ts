import type {
  GitConflictRegion,
  GitConflictSide,
  GitConflictVersion,
} from "@/shared/types/git-conflicts";

export type ConflictReadOnlyPaneProps = {
  repoPath: string;
  filePath: string;
  title: string;
  version: GitConflictVersion | null;
  language: string;
  regions: GitConflictRegion[];
  activeRegion: GitConflictRegion | null;
  acceptedRegionLabel: string | null;
  onAcceptRegion: () => void;
  onAcceptCombination: () => void;
  onIgnoreRegion: () => void;
  syncedScrollTop: number | null;
  onScrollTopChange: (scrollTop: number) => void;
};

export type ConflictTextPaneProps = {
  title: string;
  text: string;
  language: string;
  regions: GitConflictRegion[];
  activeRegion: GitConflictRegion | null;
  acceptedRegionLabel: string | null;
  actionLabel: string;
  combinationActionLabel: string;
  onAcceptRegion: () => void;
  onAcceptCombination: () => void;
  onIgnoreRegion: () => void;
  syncedScrollTop: number | null;
  onScrollTopChange: (scrollTop: number) => void;
};

export type ConflictRangePaneProps = {
  repoPath: string;
  filePath: string;
  title: string;
  side: GitConflictSide;
  totalLineCount: number;
  signature: string;
  regions: GitConflictRegion[];
  activeRegion: GitConflictRegion | null;
  acceptedRegionLabel: string | null;
  actionLabel: string;
  combinationActionLabel: string;
  onAcceptRegion: () => void;
  onAcceptCombination: () => void;
  onIgnoreRegion: () => void;
  syncedScrollTop: number | null;
  onScrollTopChange: (scrollTop: number) => void;
};
