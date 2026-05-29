import type { FileChange, FileChangeWithHunks } from "@/shared/types/git";

export type DiffDisplayMode = "unified" | "split";
export type DiffSource = "commit" | "stash";
export type DiffModalFile = FileChange | FileChangeWithHunks;
export type DiffModalSectionMode = "tracked-untracked" | "single";
export type ContextDirection = "Above" | "Below";

export type DiffLine = {
  kind: "Add" | "Del" | "Context";
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
};

export type DiffHunk = {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
  is_new_file: boolean;
};

export type DiffViewerProps = {
  repoPath: string;
  filePath: string;
  sha?: string;
  context?: number;
  onFileActionsData?: (data: {
    filePath: string;
    insertions: number;
    deletions: number;
    canStage: boolean;
    canDiscard: boolean;
    canRemove: boolean;
    onStage: () => void;
    onDiscard: () => void;
    onRemove: () => void;
  }) => void;
  fileActionsBar?: React.ReactNode;
  onWorkingTreeStageChange?: () => Promise<void> | void;
  displayMode?: DiffDisplayMode;
  onDisplayModeChange?: (mode: DiffDisplayMode) => void;
  diffSource?: DiffSource;
  externalLoading?: boolean;
  externalError?: string | null;
};

export type DiffHunkProps = {
  hunk: DiffHunk;
  filePath: string;
  hunkIdx: number;
  extraContext?: { above: DiffLine[]; below: DiffLine[] };
  isHovered: boolean;
  setHoveredHunkIdx: React.Dispatch<React.SetStateAction<number | null>>;
  handleExpandContext?: (
    hunkIdx: number,
    direction: ContextDirection,
    lines: number,
  ) => void;
  handleLineMouseDown?: (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean,
  ) => void;
  handleLineMouseEnter?: (
    hunkIdx: number,
    lineIdx: number,
    isStageable: boolean,
    isStaged: boolean,
  ) => void;
  handleStageBlock?: (hunkIdx: number, lineIdxs: number[]) => void;
  canStage?: boolean;
  displayMode?: DiffDisplayMode;
};

export type DiffModalProps = {
  open: boolean;
  files: DiffModalFile[];
  initialFile: DiffModalFile;
  onClose: () => void;
  onFileSelect?: (file: DiffModalFile) => void;
  repoPath?: string;
  sha?: string;
  changesViewMode?: import("@/features/working-changes").ChangesExplorerViewMode;
  onChangesViewModeChange?: (
    mode: import("@/features/working-changes").ChangesExplorerViewMode,
  ) => void;
  sectionMode?: DiffModalSectionMode;
  onWorkingTreeStageChange?: () => Promise<void> | void;
};

export type StageableBlock = {
  startLineIdx: number;
  endLineIdx: number;
  lineIdxs: number[];
};

export type SplitCell = {
  line: DiffLine;
  lineIdx: number;
};

export type SplitRow = {
  key: string;
  left?: SplitCell;
  right?: SplitCell;
  lineIdxs: number[];
  block?: StageableBlock;
  isBlockStart: boolean;
};
