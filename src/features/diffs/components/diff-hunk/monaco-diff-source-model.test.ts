import { describe, expect, it } from "vitest";
import { createDiffLine } from "@/test/fixtures/git";
import { buildSplitRows, getStageableBlocks } from "./diff-hunk-rendering";
import {
  buildSplitMonacoDiffSource,
  buildUnifiedMonacoDiffSource,
} from "./monaco-diff-source-model";

describe("monaco diff source models", () => {
  it("maps unified source lines back to diff line indexes", () => {
    const lines = [
      createDiffLine({ content: "same", old_lineno: 1, new_lineno: 1 }),
      createDiffLine({
        kind: "Add",
        content: "next",
        old_lineno: null,
        new_lineno: 2,
      }),
    ];

    const model = buildUnifiedMonacoDiffSource(lines);

    expect(model.value).toBe("same\nnext");
    expect(model.lines).toEqual([
      {
        content: "same",
        kind: "Context",
        lineIdx: 0,
        newLine: 1,
        oldLine: 1,
        side: "unified",
      },
      {
        content: "next",
        kind: "Add",
        lineIdx: 1,
        newLine: 2,
        oldLine: null,
        side: "unified",
      },
    ]);
  });

  it("keeps split source rows aligned when one side is empty", () => {
    const lines = [
      createDiffLine({
        kind: "Del",
        content: "old",
        old_lineno: 8,
        new_lineno: null,
      }),
      createDiffLine({
        kind: "Add",
        content: "new",
        old_lineno: null,
        new_lineno: 8,
      }),
      createDiffLine({
        kind: "Add",
        content: "extra",
        old_lineno: null,
        new_lineno: 9,
      }),
    ];
    const rows = buildSplitRows(lines, getStageableBlocks(lines));

    const oldModel = buildSplitMonacoDiffSource(rows, "old");
    const newModel = buildSplitMonacoDiffSource(rows, "new");

    expect(oldModel.value).toBe("old\n");
    expect(newModel.value).toBe("new\nextra");
    expect(oldModel.lines[1]).toMatchObject({
      content: "",
      kind: "Empty",
      lineIdx: null,
      side: "old",
    });
    expect(newModel.lines[1]).toMatchObject({
      content: "extra",
      kind: "Add",
      lineIdx: 2,
      side: "new",
    });
  });
});
