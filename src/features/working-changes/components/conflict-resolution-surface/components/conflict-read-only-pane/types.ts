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
  acceptedRegionSidesById: Record<string, GitConflictSide | null>;
  fileActionLabel: string;
  fileActionTitle: string;
  fileActionDisabled: boolean;
  onAcceptRegion: (regionId: string) => void;
  onAcceptCombination: (regionId: string) => void;
  onAcceptFile: () => void;
  onIgnoreRegion: (regionId: string) => void;
  syncedScrollTop: number | null;
  onScrollTopChange: (scrollTop: number) => void;
};

export type ConflictTextPaneProps = {
  title: string;
  side: GitConflictSide;
  text: string;
  language: string;
  regions: GitConflictRegion[];
  activeRegion: GitConflictRegion | null;
  acceptedRegionSidesById: Record<string, GitConflictSide | null>;
  actionLabel: string;
  combinationActionLabel: string;
  fileActionLabel: string;
  fileActionTitle: string;
  fileActionDisabled: boolean;
  onAcceptRegion: (regionId: string) => void;
  onAcceptCombination: (regionId: string) => void;
  onAcceptFile: () => void;
  onIgnoreRegion: (regionId: string) => void;
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
  acceptedRegionSidesById: Record<string, GitConflictSide | null>;
  actionLabel: string;
  combinationActionLabel: string;
  fileActionLabel: string;
  fileActionTitle: string;
  fileActionDisabled: boolean;
  onAcceptRegion: (regionId: string) => void;
  onAcceptCombination: (regionId: string) => void;
  onAcceptFile: () => void;
  onIgnoreRegion: (regionId: string) => void;
  syncedScrollTop: number | null;
  onScrollTopChange: (scrollTop: number) => void;
};
