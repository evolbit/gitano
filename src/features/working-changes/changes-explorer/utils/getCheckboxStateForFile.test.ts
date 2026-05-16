import { describe, expect, it } from "vitest";
import type { DiffHunk, FileChangeWithHunks } from "@/shared/types/git";
import { getCheckboxStateForFile } from "./getCheckboxStateForFile";
import type { ChangesExplorerStagedLinesState } from "./types";

const hunk: DiffHunk = {
  header: "@@ -1,2 +1,2 @@",
  old_start: 1,
  old_lines: 2,
  new_start: 1,
  new_lines: 2,
  is_new_file: false,
  lines: [
    { kind: "Context", content: "same", old_lineno: 1, new_lineno: 1 },
    { kind: "Del", content: "old", old_lineno: 2, new_lineno: null },
    { kind: "Add", content: "new", old_lineno: null, new_lineno: 2 },
  ],
};

function changedFile(status: FileChangeWithHunks["status"]): FileChangeWithHunks {
  return {
    path: "src/file.ts",
    status,
    insertions: 1,
    deletions: 1,
    hunks: [hunk],
  };
}

function stateFor(stagedLines: ChangesExplorerStagedLinesState) {
  return {
    stagedLines,
    isStagedNewFile: (filePath: string) =>
      Boolean(stagedLines[filePath]?.isNewFile),
    isWholeFileStaged: (filePath: string) =>
      Boolean(stagedLines[filePath]?.isWholeFileStaged),
  };
}

describe("getCheckboxStateForFile", () => {
  it("returns unchecked when no lines are staged", () => {
    const file = changedFile("modified");
    const state = stateFor({});

    expect(
      getCheckboxStateForFile(
        file,
        state.stagedLines,
        state.isStagedNewFile,
        state.isWholeFileStaged,
      ),
    ).toBe("unchecked");
  });

  it("returns indeterminate for partial line selections", () => {
    const file = changedFile("modified");
    const state = stateFor({ [file.path]: { 0: new Set([2]) } });

    expect(
      getCheckboxStateForFile(
        file,
        state.stagedLines,
        state.isStagedNewFile,
        state.isWholeFileStaged,
      ),
    ).toBe("indeterminate");
  });

  it("returns checked for whole-file staged tracked files", () => {
    const file = changedFile("modified");
    const state = stateFor({ [file.path]: { isWholeFileStaged: true } });

    expect(
      getCheckboxStateForFile(
        file,
        state.stagedLines,
        state.isStagedNewFile,
        state.isWholeFileStaged,
      ),
    ).toBe("checked");
  });

  it("returns checked for staged untracked files", () => {
    const file = changedFile("added");
    const state = stateFor({ [file.path]: { isNewFile: true } });

    expect(
      getCheckboxStateForFile(
        file,
        state.stagedLines,
        state.isStagedNewFile,
        state.isWholeFileStaged,
      ),
    ).toBe("checked");
  });
});
