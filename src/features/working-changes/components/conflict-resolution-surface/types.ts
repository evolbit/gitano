import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";

export type ConflictResolutionSurfaceProps = {
  repoPath: string;
  filePath: string;
  fileSignature?: string | null;
  conflicts: ChangesExplorerFile[];
  onSelectConflictPath: (path: string) => void;
  onClose: () => void;
  onResolved?: () => void;
};
