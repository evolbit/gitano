import { describe, expect, it } from "vitest";
import { GIT_CONFLICT_SIDE } from "@/shared/types/git-conflicts";
import type { ConflictResolutionRegion } from "./conflict-result-projection";
import {
  alignSidePaneRegions,
  buildSidePaneRegions,
} from "./conflict-side-region-projection";

function region(
  overrides: Partial<ConflictResolutionRegion> = {},
): ConflictResolutionRegion {
  return {
    id: "conflict-1",
    resultStartLine: 70,
    resultSeparatorLine: null,
    resultEndLine: 78,
    baseText: "base",
    currentText: "current-one\ncurrent-two",
    incomingText: "incoming-one\nincoming-two",
    paddingLineCount: 0,
    unresolvedText: "base",
    ...overrides,
  };
}

describe("conflict side region projection", () => {
  it("positions current side regions from current text rather than result lines", () => {
    const sideRegions = buildSidePaneRegions({
      regions: [region()],
      side: GIT_CONFLICT_SIDE.Current,
      sideText: [
        "header",
        "current-one",
        "current-two",
        "footer",
      ].join("\n"),
    });

    expect(sideRegions).toEqual([
      {
        id: "conflict-1",
        resultStartLine: 2,
        resultSeparatorLine: null,
        resultEndLine: 3,
      },
    ]);
  });

  it("positions incoming side regions from incoming text", () => {
    const sideRegions = buildSidePaneRegions({
      regions: [region()],
      side: GIT_CONFLICT_SIDE.Incoming,
      sideText: [
        "header",
        "incoming-one",
        "incoming-two",
        "footer",
      ].join("\n"),
    });

    expect(sideRegions[0]).toMatchObject({
      id: "conflict-1",
      resultStartLine: 2,
      resultEndLine: 3,
    });
  });

  it("matches duplicate side regions in order", () => {
    const sideRegions = buildSidePaneRegions({
      regions: [
        region({ id: "conflict-1", currentText: "same" }),
        region({
          id: "conflict-2",
          resultStartLine: 90,
          resultEndLine: 95,
          currentText: "same",
        }),
      ],
      side: GIT_CONFLICT_SIDE.Current,
      sideText: ["same", "between", "same"].join("\n"),
    });

    expect(sideRegions).toEqual([
      {
        id: "conflict-1",
        resultStartLine: 1,
        resultSeparatorLine: null,
        resultEndLine: 1,
      },
      {
        id: "conflict-2",
        resultStartLine: 3,
        resultSeparatorLine: null,
        resultEndLine: 3,
      },
    ]);
  });

  it("falls back to result lines when the side text cannot be matched", () => {
    const sideRegions = buildSidePaneRegions({
      regions: [region()],
      side: GIT_CONFLICT_SIDE.Current,
      sideText: "unrelated",
    });

    expect(sideRegions[0]).toMatchObject({
      id: "conflict-1",
      resultStartLine: 70,
      resultSeparatorLine: null,
      resultEndLine: 78,
    });
  });

  it("adds display-only alignment counts to the shorter side regions", () => {
    const aligned = alignSidePaneRegions({
      incomingRegions: [
        {
          id: "conflict-1",
          resultStartLine: 10,
          resultSeparatorLine: null,
          resultEndLine: 11,
        },
      ],
      currentRegions: [
        {
          id: "conflict-1",
          resultStartLine: 10,
          resultSeparatorLine: null,
          resultEndLine: 14,
        },
      ],
    });

    expect(aligned.incomingRegions[0]).toMatchObject({
      id: "conflict-1",
      alignmentLineCount: 3,
    });
    expect(aligned.currentRegions[0]).toMatchObject({
      id: "conflict-1",
      alignmentLineCount: 0,
    });
  });
});
