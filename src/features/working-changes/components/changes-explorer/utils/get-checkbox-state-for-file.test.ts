import { describe, expect, it } from "vitest";
import { ChangeType, type DiffHunk, type FileChangeWithHunks } from "@/shared/types/git";
import { getCheckboxStateForFile } from "./get-checkbox-state-for-file";
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
    hunks: [{ ...hunk, is_new_file: status === "added" }],
  };
}

function stateFor(stagedLines: ChangesExplorerStagedLinesState) {
  return {
    stagedLines,
    isStagedNewFile: (filePath: string) =>
      Boolean(stagedLines[filePath]?.isNewFile),
    isWholeFileStaged: (filePath: string) =>
      Boolean(stagedLines[filePath]?.isWholeFileStaged),
    isPartiallyStaged: (filePath: string) =>
      Boolean(stagedLines[filePath]?.isPartiallyStaged),
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
        state.isPartiallyStaged,
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
        state.isPartiallyStaged,
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
        state.isPartiallyStaged,
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
        state.isPartiallyStaged,
      ),
    ).toBe("checked");
  });

  it("returns indeterminate from summary-only partial staged state", () => {
    const file = changedFile("modified");
    const state = stateFor({ [file.path]: { isPartiallyStaged: true } });

    expect(
      getCheckboxStateForFile(
        file,
        state.stagedLines,
        state.isStagedNewFile,
        state.isWholeFileStaged,
        state.isPartiallyStaged,
      ),
    ).toBe("indeterminate");
  });

  it("returns unchecked for conflicted files", () => {
    const file = changedFile(ChangeType.Conflicted);
    const state = stateFor({ [file.path]: { isWholeFileStaged: true } });

    expect(
      getCheckboxStateForFile(
        file,
        state.stagedLines,
        state.isStagedNewFile,
        state.isWholeFileStaged,
        state.isPartiallyStaged,
      ),
    ).toBe("unchecked");
  });
});
