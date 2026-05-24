import { describe, expect, it } from "vitest";
import {
  createDiffHunk,
  createFileChange,
  createFileChangeWithHunks,
} from "@/test/fixtures/git";
import { buildAllStageableLineMap } from "./build-all-stageable-line-map";

describe("buildAllStageableLineMap", () => {
  it("returns every add and delete line by hunk", () => {
    const file = createFileChangeWithHunks({
      hunks: [
        createDiffHunk(),
        createDiffHunk({
          lines: [
            { kind: "Context", content: "same", old_lineno: 4, new_lineno: 4 },
            { kind: "Add", content: "newer", old_lineno: null, new_lineno: 5 },
          ],
        }),
      ],
    });

    expect(buildAllStageableLineMap(file)).toEqual({
      0: [1, 2],
      1: [1],
    });
  });

  it("returns an empty map for files without hunk details", () => {
    expect(buildAllStageableLineMap(createFileChange())).toEqual({});
  });
});
