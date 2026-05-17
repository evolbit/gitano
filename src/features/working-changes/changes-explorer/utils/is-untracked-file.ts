import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";

export function isUntrackedFile(file: ChangesExplorerFile) {
  if (file.status !== "added") return false;
  if (!("hunks" in file)) return false;
  return true;
}
