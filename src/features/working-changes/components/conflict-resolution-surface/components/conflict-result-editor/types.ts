import type { ConflictResolutionRegion } from "../../utils/conflict-result-projection";

export type ConflictResultEditorProps = {
  filePath: string;
  content: string;
  language: string;
  resultRegions: ConflictResolutionRegion[];
  dirty: boolean;
  unsupportedReason: string | null;
  acceptedRegionLabel: string | null;
  onChange: (content: string) => void;
  onSave: () => void;
  onAcceptCurrentRegion: () => void;
  onAcceptIncomingRegion: () => void;
  onRemoveAcceptedRegionSide: () => void;
  onAcceptCurrentFile: () => void;
  onAcceptIncomingFile: () => void;
  onMarkResolved: () => void;
  canAcceptRegion: boolean;
  canAcceptFile: boolean;
  markResolvedBlockedReason: string | null;
  actionInFlight: boolean;
  syncedScrollTop: number | null;
  onScrollTopChange: (scrollTop: number) => void;
};
