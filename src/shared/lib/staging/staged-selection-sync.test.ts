import { describe, expect, it } from "vitest";
import type { DiffHunk, DiffLine, FileChangeWithHunks } from "@/shared/types/git";
import { buildSyncedStagedLinesState } from "./staged-selection-sync";

function line(
  kind: DiffLine["kind"],
  content: string,
  old_lineno: number | null,
  new_lineno: number | null,
): DiffLine {
  return { kind, content, old_lineno, new_lineno };
}

function hunk(lines: DiffLine[]): DiffHunk {
  return {
    header: "@@ -1,3 +1,3 @@",
    old_start: 1,
    old_lines: 3,
    new_start: 1,
    new_lines: 3,
    is_new_file: false,
    lines,
  };
}

function changedFile(
  status: FileChangeWithHunks["status"],
): FileChangeWithHunks {
  return {
    path: "src/file.ts",
    status,
    insertions: 1,
    deletions: 1,
    hunks: [
      hunk([
        line("Context", "same", 1, 1),
        line("Del", "old", 2, null),
        line("Add", "new", null, 2),
      ]),
    ],
  };
}

describe("staged selection sync", () => {
  it("builds partial line selections from staged hunks", () => {
    const file = changedFile("modified");
    const result = buildSyncedStagedLinesState([file], {
      [file.path]: [hunk([line("Add", "new", null, 2)])],
    });

    expect(result[file.path]?.[0]).toEqual(new Set([2]));
  });

  it("marks modified files as whole-file staged when all stageable lines match", () => {
    const file = changedFile("modified");
    const result = buildSyncedStagedLinesState([file], {
      [file.path]: file.hunks,
    });

    expect(result[file.path]).toEqual({ isWholeFileStaged: true });
  });

  it("marks added files as new-file staged when all stageable lines match", () => {
    const file = changedFile("added");
    const result = buildSyncedStagedLinesState([file], {
      [file.path]: file.hunks,
    });

    expect(result[file.path]).toEqual({ isNewFile: true });
  });
});
