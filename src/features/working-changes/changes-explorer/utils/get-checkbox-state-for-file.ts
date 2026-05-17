import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import {
  ChangesExplorerCheckboxState,
  ChangesExplorerStagedLinesState,
} from "./types";
import { isUntrackedFile } from "./is-untracked-file";

export function getCheckboxStateForFile(
  file: ChangesExplorerFile,
  stagedLines: ChangesExplorerStagedLinesState,
  isStagedNewFile: (filePath: string) => boolean,
  isWholeFileStaged: (filePath: string) => boolean,
): ChangesExplorerCheckboxState {
  const fileStaged = stagedLines[file.path] || {};
  const hunks = "hunks" in file ? file.hunks : [];
  let totalStageable = 0;

  hunks.forEach((hunk) => {
    totalStageable += hunk.lines.filter(
      (line) => line.kind === "Add" || line.kind === "Del",
    ).length;
  });

  let stagedCount = 0;
  for (const hunkIdx in fileStaged) {
    const value = fileStaged[hunkIdx];
    stagedCount += value instanceof Set ? value.size : 0;
  }

  if (isUntrackedFile(file)) {
    if (isStagedNewFile(file.path) || isWholeFileStaged(file.path)) {
      return "checked" as const;
    }
    if (stagedCount === 0) return "unchecked" as const;
    if (totalStageable === 0) return "checked" as const;
    if (stagedCount === totalStageable && totalStageable > 0) {
      return "checked" as const;
    }
    return "indeterminate" as const;
  }

  if (isWholeFileStaged(file.path)) {
    return "checked" as const;
  }

  if (stagedCount === 0) return "unchecked" as const;
  if (totalStageable === 0) return "checked" as const;
  if (stagedCount === totalStageable && totalStageable > 0) {
    return "checked" as const;
  }
  return "indeterminate" as const;
}
