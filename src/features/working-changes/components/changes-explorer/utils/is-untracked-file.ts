import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";

export function isUntrackedFile(file: ChangesExplorerFile) {
  if ("isUntracked" in file) return file.isUntracked;
  if (file.status !== "added") return false;
  if (!("hunks" in file)) return false;
  return file.hunks.some((hunk) => hunk.is_new_file);
}
