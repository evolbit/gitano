import { describe, expect, it } from "vitest";
import {
  createDiffHunk,
  createFileChangeWithHunks,
  createStagedSelection,
} from "@/test/fixtures/git";
import {
  buildWorkingChangeFileSignature,
  buildWorkingChangesFileSnapshotSignature,
  buildWorkingChangesStagedSnapshotSignature,
  mergeWorkingChangesPreservingIdentity,
} from "./working-changes-snapshot";

describe("working changes snapshot utilities", () => {
  it("includes hunk line content in file signatures", () => {
    const original = createFileChangeWithHunks();
    const changed = createFileChangeWithHunks({
      hunks: [
        createDiffHunk({
          lines: [
            { kind: "Context", content: "same", old_lineno: 1, new_lineno: 1 },
            { kind: "Add", content: "different", old_lineno: null, new_lineno: 2 },
          ],
        }),
      ],
    });

    expect(buildWorkingChangeFileSignature(original)).not.toBe(
      buildWorkingChangeFileSignature(changed),
    );
  });

  it("builds stable staged signatures regardless of object key order", () => {
    const left = buildWorkingChangesStagedSnapshotSignature({
      "b.ts": createStagedSelection({ hunks: { 2: [4], 1: [2] } }),
      "a.ts": createStagedSelection({ isWholeFileStaged: true }),
    });
    const right = buildWorkingChangesStagedSnapshotSignature({
      "a.ts": createStagedSelection({ isWholeFileStaged: true }),
      "b.ts": createStagedSelection({ hunks: { 1: [2], 2: [4] } }),
    });

    expect(left).toBe(right);
  });

  it("preserves file and array identity when snapshots are unchanged", () => {
    const file = createFileChangeWithHunks();
    const previous = [file];
    const next = createFileChangeWithHunks();
    const merged = mergeWorkingChangesPreservingIdentity(previous, [next]);

    expect(merged).toBe(previous);
    expect(merged[0]).toBe(file);
  });

  it("replaces changed files without disturbing unchanged siblings", () => {
    const stableFile = createFileChangeWithHunks({ path: "stable.ts" });
    const previousChanged = createFileChangeWithHunks({ path: "changed.ts" });
    const nextChanged = createFileChangeWithHunks({
      path: "changed.ts",
      hunks: [createDiffHunk({ header: "@@ -1,1 +1,2 @@" })],
    });

    expect(
      mergeWorkingChangesPreservingIdentity(
        [stableFile, previousChanged],
        [createFileChangeWithHunks({ path: "stable.ts" }), nextChanged],
      ),
    ).toEqual([stableFile, nextChanged]);
  });

  it("joins file signatures in snapshot order", () => {
    const signature = buildWorkingChangesFileSnapshotSignature([
      createFileChangeWithHunks({ path: "a.ts" }),
      createFileChangeWithHunks({ path: "b.ts" }),
    ]);

    expect(signature.indexOf("a.ts")).toBeLessThan(signature.indexOf("b.ts"));
  });
});
