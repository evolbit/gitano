import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { isConflictedFile } from "./is-conflicted-file";
import { isUntrackedFile } from "./is-untracked-file";

export function partitionFiles(
  files: ChangesExplorerFile[],
  sectionMode: "tracked-untracked" | "single",
) {
  if (sectionMode === "single") {
    return files.length > 0 ? [{ name: "Tracked" as const, files }] : [];
  }

  const conflicts: ChangesExplorerFile[] = [];
  const tracked: ChangesExplorerFile[] = [];
  const untracked: ChangesExplorerFile[] = [];

  files.forEach((file) => {
    if (isConflictedFile(file)) {
      conflicts.push(file);
      return;
    }

    if (isUntrackedFile(file)) {
      untracked.push(file);
      return;
    }
    tracked.push(file);
  });

  return [
    { name: "Conflicts" as const, files: conflicts },
    { name: "Tracked" as const, files: tracked },
    { name: "Untracked" as const, files: untracked },
  ].filter((section) => section.files.length > 0);
}
