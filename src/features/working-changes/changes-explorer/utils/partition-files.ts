import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { isUntrackedFile } from "./is-untracked-file";

export function partitionFiles(
  files: ChangesExplorerFile[],
  sectionMode: "tracked-untracked" | "single",
) {
  if (sectionMode === "single") {
    return files.length > 0 ? [{ name: "Tracked" as const, files }] : [];
  }

  const tracked: ChangesExplorerFile[] = [];
  const untracked: ChangesExplorerFile[] = [];

  files.forEach((file) => {
    if (isUntrackedFile(file)) {
      untracked.push(file);
      return;
    }
    tracked.push(file);
  });

  return [
    { name: "Tracked" as const, files: tracked },
    { name: "Untracked" as const, files: untracked },
  ].filter((section) => section.files.length > 0);
}
