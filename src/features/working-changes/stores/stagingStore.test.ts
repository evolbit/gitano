import { beforeEach, describe, expect, it } from "vitest";
import { useStagedLinesStore } from "./stagingStore";

describe("staging store", () => {
  beforeEach(() => {
    useStagedLinesStore.getState().clearAllStagedLines();
  });

  it("stores staged line selections as Sets", () => {
    useStagedLinesStore
      .getState()
      .setAllStagedLinesForFile("src/file.ts", { 0: [1, 2], 2: [8] });

    const staged = useStagedLinesStore.getState().stagedLines["src/file.ts"];

    expect(Array.from(staged[0])).toEqual([1, 2]);
    expect(Array.from(staged[2])).toEqual([8]);
  });

  it("preserves file flags when replacing line selection for a file", () => {
    useStagedLinesStore.getState().setStagedNewFile("src/file.ts", true);
    useStagedLinesStore.getState().setWholeFileStaged("src/file.ts", true);

    useStagedLinesStore
      .getState()
      .setLineSelectionForFile("src/file.ts", { 1: new Set([4]) });

    const staged = useStagedLinesStore.getState().stagedLines["src/file.ts"];
    expect(staged.isNewFile).toBe(true);
    expect(staged.isWholeFileStaged).toBe(true);
    expect(Array.from(staged[1])).toEqual([4]);
  });

  it("removes whole-file flags without dropping new-file state or line selections", () => {
    useStagedLinesStore.getState().setStagedNewFile("src/file.ts", true);
    useStagedLinesStore
      .getState()
      .setStagedLines("src/file.ts", 0, new Set([1]));
    useStagedLinesStore.getState().setWholeFileStaged("src/file.ts", true);

    useStagedLinesStore.getState().setWholeFileStaged("src/file.ts", false);

    const staged = useStagedLinesStore.getState().stagedLines["src/file.ts"];
    expect(staged.isWholeFileStaged).toBeUndefined();
    expect(staged.isNewFile).toBe(true);
    expect(Array.from(staged[0])).toEqual([1]);
  });
});

