import type { DiffLine } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changesExplorerTree";

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
