import { DiffHunk, DiffLine, FileChangeWithHunks } from "../types/git";
import { StagedLinesState } from "../store/staging";

type StagedStateByFile = StagedLinesState["stagedLines"];

function buildLineKey(line: DiffLine) {
  return `${line.kind}:${line.old_lineno ?? ""}:${line.new_lineno ?? ""}:${line.content}`;
}

function buildPartialSelection(
  workingHunks: DiffHunk[],
  stagedHunks: DiffHunk[],
) {
  const stagedKeys = new Set<string>();
  stagedHunks.forEach((hunk) => {
    hunk.lines.forEach((line) => {
      if (line.kind === "Add" || line.kind === "Del") {
        stagedKeys.add(buildLineKey(line));
      }
    });
  });

  const selection: Record<number, Set<number>> = {};
  let totalStageable = 0;
  let totalSelected = 0;

  workingHunks.forEach((hunk, hunkIdx) => {
    const selected = new Set<number>();

    hunk.lines.forEach((line, lineIdx) => {
      if (line.kind !== "Add" && line.kind !== "Del") return;
      totalStageable += 1;
      if (!stagedKeys.has(buildLineKey(line))) return;
      selected.add(lineIdx);
      totalSelected += 1;
    });

    if (selected.size > 0) {
      selection[hunkIdx] = selected;
    }
  });

  return { selection, totalStageable, totalSelected };
}

export function buildSyncedStagedLinesState(
  files: FileChangeWithHunks[],
  stagedHunksByFile: Record<string, DiffHunk[]>,
): StagedStateByFile {
  const nextState: StagedStateByFile = {};

  files.forEach((file) => {
    const stagedHunks = stagedHunksByFile[file.path] || [];
    if (stagedHunks.length === 0) return;

    const { selection, totalStageable, totalSelected } = buildPartialSelection(
      file.hunks,
      stagedHunks,
    );

    if (totalSelected === 0) return;

    if (totalStageable > 0 && totalSelected === totalStageable) {
      if (file.status === "added") {
        nextState[file.path] = { isNewFile: true };
      } else {
        nextState[file.path] = { isWholeFileStaged: true };
      }
      return;
    }

    nextState[file.path] = selection;
  });

  return nextState;
}
