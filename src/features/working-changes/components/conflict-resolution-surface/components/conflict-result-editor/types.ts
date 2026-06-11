import type { ConflictResolutionRegion } from "../../utils/conflict-result-projection";

export type AcceptedResultRegion = {
  label: string;
  regionId: string;
};

export type ConflictResultEditorProps = {
  filePath: string;
  content: string;
  language: string;
  resultRegions: ConflictResolutionRegion[];
  dirty: boolean;
  unsupportedReason: string | null;
  acceptedRegions: AcceptedResultRegion[];
  onChange: (content: string) => void;
  onSave: () => void;
  onRemoveAcceptedRegionSide: (regionId: string) => void;
  onResetResult: () => void;
  onMarkResolved: () => void;
  markResolvedBlockedReason: string | null;
  actionInFlight: boolean;
  syncedScrollTop: number | null;
  onScrollTopChange: (scrollTop: number) => void;
};
