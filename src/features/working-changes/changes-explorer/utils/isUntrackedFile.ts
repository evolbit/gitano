import type { ChangesExplorerFile } from "@/shared/lib/tree/changesExplorerTree";

export function isUntrackedFile(file: ChangesExplorerFile) {
  if (file.status !== "added") return false;
  if (!("hunks" in file)) return false;
  return true;
}
