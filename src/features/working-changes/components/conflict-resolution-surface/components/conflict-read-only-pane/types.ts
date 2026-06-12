import type {
  GitConflictSide,
  GitConflictVersion,
} from "@/shared/types/git-conflicts";
import type { ConflictScrollHandle } from "../../utils/conflict-scroll-sync";
import type { ConflictSidePaneRegion } from "../../utils/conflict-side-region-projection";

export type ConflictReadOnlyPaneProps = {
  repoPath: string;
  filePath: string;
  title: string;
  side: GitConflictSide;
  version: GitConflictVersion | null;
  language: string;
  regions: ConflictSidePaneRegion[];
  activeRegion: ConflictSidePaneRegion | null;
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
  onScrollPaneMount?: (handle: ConflictScrollHandle | null) => void;
};

export type ConflictTextPaneProps = {
  title: string;
  side: GitConflictSide;
  text: string;
  language: string;
  regions: ConflictSidePaneRegion[];
  activeRegion: ConflictSidePaneRegion | null;
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
  onScrollPaneMount?: (handle: ConflictScrollHandle | null) => void;
};

export type ConflictRangePaneProps = {
  repoPath: string;
  filePath: string;
  title: string;
  side: GitConflictSide;
  totalLineCount: number;
  signature: string;
  regions: ConflictSidePaneRegion[];
  activeRegion: ConflictSidePaneRegion | null;
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
  onScrollPaneMount?: (handle: ConflictScrollHandle | null) => void;
};
