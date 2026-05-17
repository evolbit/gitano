import type { StashFileChange } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";

export function toChangesExplorerFile(
  file: StashFileChange,
): ChangesExplorerFile {
  return {
    path: file.path,
    status: file.status === "typechanged" ? "typeChanged" : file.status,
    insertions: file.insertions,
    deletions: file.deletions,
  };
}

export function toSelectedStashFileSet(files: StashFileChange[]) {
  return new Set(files.map((file) => file.path));
}

