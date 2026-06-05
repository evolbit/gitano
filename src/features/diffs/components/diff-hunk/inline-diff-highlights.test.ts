import { describe, expect, it } from "vitest";
import { createDiffLine } from "@/test/fixtures/git";
import type { StageableBlock } from "../../types";
import {
  buildInlineDiffHighlightRanges,
  getInlineChangedRanges,
} from "./inline-diff-highlights";

const changedBlock: StageableBlock = {
  startLineIdx: 0,
  endLineIdx: 1,
  lineIdxs: [0, 1],
};

describe("inline diff highlights", () => {
  it("finds the changed middle range between comparable lines", () => {
    const ranges = getInlineChangedRanges(
      '"@mantine/hooks": "^8.0.2",',
      '"@mantine/hooks": "^8.3.10",',
    );

    expect(ranges).toEqual({
      deleted: { start: 22, end: 25 },
      added: { start: 22, end: 26 },
    });
  });

  it("maps paired deleted and added lines to their inline ranges", () => {
    const ranges = buildInlineDiffHighlightRanges(
      [
        createDiffLine({
          kind: "Del",
          content: '"@mantine/hooks": "^8.0.2",',
        }),
        createDiffLine({
          kind: "Add",
          content: '"@mantine/hooks": "^8.3.10",',
        }),
      ],
      [changedBlock],
    );

    expect(ranges.get(0)).toEqual({ start: 22, end: 25 });
    expect(ranges.get(1)).toEqual({ start: 22, end: 26 });
  });

  it("does not map unmatched changed lines", () => {
    const ranges = buildInlineDiffHighlightRanges(
      [
        createDiffLine({
          kind: "Add",
          content: '"@mantine/hooks": "^8.3.10",',
        }),
      ],
      [{ startLineIdx: 0, endLineIdx: 0, lineIdxs: [0] }],
    );

    expect(ranges.size).toBe(0);
  });
});
