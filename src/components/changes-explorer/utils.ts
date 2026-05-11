import { DiffLine, FileChange } from "../../types/git";
import { StagedLinesState } from "../../store/staging";
import { ChangesExplorerFile, ChangesExplorerTreeNode } from "../../utils/changesExplorerTree";

export type ChangesExplorerCheckboxState =
  | "checked"
  | "indeterminate"
  | "unchecked";

const ALLOWED_STATUSES = [
  "added",
  "deleted",
  "modified",
  "renamed",
  "copied",
  "typeChanged",
] as const;

export function normalizeStatus(status: string): FileChange["status"] {
  return ALLOWED_STATUSES.includes(status as FileChange["status"])
    ? (status as FileChange["status"])
    : "modified";
}

export function normalizeFiles(files: ChangesExplorerFile[]): ChangesExplorerFile[] {
  return files.map((file) => ({
    ...file,
    status: normalizeStatus(file.status),
  }));
}

export function isUntrackedFile(file: ChangesExplorerFile) {
  if (file.status !== "added") return false;
  if (!("hunks" in file)) return false;
  return true;
}

export function getShowInFileManagerLabel() {
  if (typeof navigator === "undefined") {
    return "Show in File Manager";
  }

  const platform = navigator.userAgent.toLowerCase();

  if (platform.includes("mac")) {
    return "Show in Finder";
  }

  if (platform.includes("win")) {
    return "Show in Explorer";
  }

  return "Show in File Manager";
}

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

export function fileMatchesSearch(file: ChangesExplorerFile, search: string) {
  if (!search) return true;
  return file.path.toLowerCase().includes(search.toLowerCase());
}

export function serializeLineSelection(
  selection: Record<number, Set<number>> | undefined,
): Record<number, number[]> {
  const hunks: Record<number, number[]> = {};

  if (!selection) return hunks;

  Object.entries(selection).forEach(([hunkIdx, lineSet]) => {
    if (!(lineSet instanceof Set) || lineSet.size === 0) return;
    hunks[Number(hunkIdx)] = Array.from(lineSet).sort((a, b) => a - b);
  });

  return hunks;
}

export function cloneStagedLinesState(
  stagedLines: StagedLinesState["stagedLines"],
) {
  return Object.fromEntries(
    Object.entries(stagedLines).map(([filePath, fileSelection]) => [
      filePath,
      Object.fromEntries(
        Object.entries(fileSelection).map(([key, value]) => [
          key,
          value instanceof Set ? new Set(value) : value,
        ]),
      ),
    ]),
  ) as typeof stagedLines;
}

export function buildAllStageableLineMap(file: ChangesExplorerFile) {
  if (!("hunks" in file)) return {};

  const allHunks: Record<number, number[]> = {};

  file.hunks.forEach((hunk, hunkIdx) => {
    const lineIdxs = hunk.lines
      .map((line: DiffLine, idx: number) =>
        line.kind === "Add" || line.kind === "Del" ? idx : null,
      )
      .filter((lineIdx) => lineIdx !== null) as number[];

    if (lineIdxs.length > 0) {
      allHunks[hunkIdx] = lineIdxs;
    }
  });

  return allHunks;
}

export function getCheckboxStateForFile(
  file: ChangesExplorerFile,
  stagedLines: StagedLinesState["stagedLines"],
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

export function getFolderCheckboxState(
  filesInFolder: ChangesExplorerFile[],
  getCheckboxState: (
    file: ChangesExplorerFile,
  ) => ChangesExplorerCheckboxState,
): ChangesExplorerCheckboxState {
  if (filesInFolder.length === 0) return "unchecked" as const;

  const checkedCount = filesInFolder.filter(
    (file) => getCheckboxState(file) === "checked",
  ).length;

  if (checkedCount === 0) return "unchecked" as const;
  if (checkedCount === filesInFolder.length) return "checked" as const;
  return "indeterminate" as const;
}

export function getTreeDescendants(
  node: ChangesExplorerTreeNode,
): ChangesExplorerFile[] {
  if (node.kind === "file") return [node.file];
  return node.children.flatMap((child) => getTreeDescendants(child));
}
