import type { GitConflictFileDetail } from "@/shared/types/git-conflicts";

export type ConflictMetadataBarProps = {
  detail: GitConflictFileDetail;
  activeRegionIndex: number;
  onPreviousRegion: () => void;
  onNextRegion: () => void;
};
