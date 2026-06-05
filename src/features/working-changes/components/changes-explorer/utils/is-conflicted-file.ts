import { ChangeType } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";

export function isConflictedFile(file: ChangesExplorerFile) {
  return file.status === ChangeType.Conflicted;
}
