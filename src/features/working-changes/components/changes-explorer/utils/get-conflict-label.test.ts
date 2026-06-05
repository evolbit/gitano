import { describe, expect, it } from "vitest";
import { ChangeType } from "@/shared/types/git";
import type { ChangesExplorerConflictFile } from "@/shared/lib/tree/changes-explorer-tree";
import { createFileChange } from "@/test/fixtures/git";
import { getConflictLabel } from "./get-conflict-label";

describe("getConflictLabel", () => {
  it("formats conflict counts when available", () => {
    const conflictedFile: ChangesExplorerConflictFile = {
      path: "src/conflict.ts",
      status: ChangeType.Conflicted,
      insertions: 0,
      deletions: 0,
      conflictCount: 2,
    };

    expect(getConflictLabel(conflictedFile)).toBe("2 conflicts");
  });

  it("returns a fallback conflict label without count metadata", () => {
    expect(
      getConflictLabel(createFileChange({ status: ChangeType.Conflicted })),
    ).toBe("Conflict");
  });

  it("does not label normal files", () => {
    expect(getConflictLabel(createFileChange())).toBeNull();
  });
});
