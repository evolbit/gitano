import { describe, expect, it } from "vitest";
import type { GitConflictRegion } from "@/shared/types/git-conflicts";
import {
  buildConflictResultProjection,
  replaceProjectedResultRegionWithContent,
} from "./conflict-result-projection";

const region: GitConflictRegion = {
  id: "conflict-1",
  resultStartLine: 2,
  resultSeparatorLine: 4,
  resultEndLine: 6,
};

const resultText = [
  "before",
  "<<<<<<< HEAD",
  "current",
  "=======",
  "incoming",
  ">>>>>>> branch",
  "after",
].join("\n");

describe("conflict result projection", () => {
  it("builds a base-backed result projection for unresolved regions", () => {
    const projection = buildConflictResultProjection({
      baseText: ["before", "base", "after"].join("\n"),
      regions: [region],
      resultText,
    });

    expect(projection.content).toBe(["before", "base", "after"].join("\n"));
    expect(projection.regions[0]).toMatchObject({
      id: "conflict-1",
      resultStartLine: 2,
      resultSeparatorLine: null,
      resultEndLine: 2,
      baseText: "base",
      currentText: "current",
      incomingText: "incoming",
      paddingLineCount: 0,
      unresolvedText: "base",
    });
  });

  it("falls back to the raw worktree result when base is unavailable", () => {
    const projection = buildConflictResultProjection({
      baseText: null,
      regions: [region],
      resultText,
    });

    expect(projection.content).toBe(resultText);
    expect(projection.regions[0]).toMatchObject({
      currentText: "current",
      incomingText: "incoming",
    });
  });

  it("tracks visual padding rows when the base chunk is shorter than a side", () => {
    const projection = buildConflictResultProjection({
      baseText: ["before", "base", "after"].join("\n"),
      regions: [
        {
          ...region,
          resultSeparatorLine: 5,
          resultEndLine: 7,
        },
      ],
      resultText: [
        "before",
        "<<<<<<< HEAD",
        "current",
        "current-extra",
        "=======",
        "incoming",
        ">>>>>>> branch",
        "after",
      ].join("\n"),
    });

    expect(projection.regions[0].paddingLineCount).toBe(1);
  });

  it("replaces projected result regions and shifts following regions", () => {
    const projection = buildConflictResultProjection({
      baseText: ["before", "base", "middle", "second-base", "after"].join("\n"),
      regions: [
        region,
        {
          id: "conflict-2",
          resultStartLine: 8,
          resultSeparatorLine: 10,
          resultEndLine: 12,
        },
      ],
      resultText: [
        "before",
        "<<<<<<< HEAD",
        "current",
        "=======",
        "incoming",
        ">>>>>>> branch",
        "middle",
        "<<<<<<< HEAD",
        "second-current",
        "=======",
        "second-incoming",
        ">>>>>>> branch",
        "after",
      ].join("\n"),
    });

    const next = replaceProjectedResultRegionWithContent({
      resultText: projection.content,
      regions: projection.regions,
      region: projection.regions[0],
      replacementText: "resolved\nextra",
    });

    expect(next.content).toContain("resolved\nextra\nmiddle");
    expect(next.regions[1].resultStartLine).toBe(5);
  });
});
