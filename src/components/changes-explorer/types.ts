import { ChangesExplorerFile } from "../../utils/changesExplorerTree";

export type ChangesExplorerViewMode = "flat" | "tree";

export type ChangesExplorerSurface = "main" | "modal";
export type SectionName = "Tracked" | "Untracked";
export type SectionMode = "tracked-untracked" | "single";
export type ChangesExplorerSection = {
  name: SectionName;
  files: ChangesExplorerFile[];
};
export type ContextMenuScope =
  | { kind: "pane" }
  | { kind: "file"; file: ChangesExplorerFile }
  | {
      kind: "folder";
      folderPath: string;
      files: ChangesExplorerFile[];
      isUntracked: boolean;
    };

export type ChangesExplorerProps = {
  files: ChangesExplorerFile[];
  selectedPath: string | null;
  onSelectFile: (file: ChangesExplorerFile) => void;
  viewMode: ChangesExplorerViewMode;
  onViewModeChange: (mode: ChangesExplorerViewMode) => void;
  showFileCheckboxes: boolean;
  surface: ChangesExplorerSurface;
  showHeader?: boolean;
  autoFocusSearch?: boolean;
  className?: string;
  sectionMode?: SectionMode;
  expandedState?: Record<string, boolean>;
  onExpandedStateChange?: (expanded: Record<string, boolean>) => void;
  repoPath?: string;
  onImmediateStageChange?: () => Promise<void> | void;
  isLoading?: boolean;
  emptyStateMessage?: string;
};
