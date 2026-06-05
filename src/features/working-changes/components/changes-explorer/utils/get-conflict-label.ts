import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { isConflictedFile } from "./is-conflicted-file";

export function getConflictLabel(file: ChangesExplorerFile) {
  if (!isConflictedFile(file)) return null;

  const conflictCount =
    "conflictCount" in file && typeof file.conflictCount === "number"
      ? file.conflictCount
      : null;

  if (!conflictCount) return "Conflict";

  return `${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`;
}
