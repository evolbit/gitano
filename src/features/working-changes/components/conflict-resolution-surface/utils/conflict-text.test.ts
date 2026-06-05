import { describe, expect, it } from "vitest";
import { GIT_CONFLICT_SIDE } from "@/shared/types/git-conflicts";
import type { GitConflictRegion } from "@/shared/types/git-conflicts";
import {
  hasUnresolvedConflictMarkers,
  isLineInConflictRegion,
  replaceResultRegionWithCombination,
  replaceResultRegionWithContent,
  replaceResultRegionWithSide,
  splitConflictTextLines,
} from "./conflict-text";

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

describe("conflict text helpers", () => {
  it("splits text into display lines", () => {
    expect(splitConflictTextLines("a\nb")).toEqual(["a", "b"]);
    expect(splitConflictTextLines("")).toEqual([""]);
  });

  it("detects lines inside conflict regions", () => {
    expect(isLineInConflictRegion(3, [region])).toBe(true);
    expect(isLineInConflictRegion(7, [region])).toBe(false);
  });

  it("detects complete unresolved conflict marker groups", () => {
    expect(hasUnresolvedConflictMarkers(resultText)).toBe(true);
    expect(hasUnresolvedConflictMarkers("<<<<<<< HEAD\ncurrent")).toBe(false);
    expect(hasUnresolvedConflictMarkers("merged\ncontent")).toBe(false);
  });

  it("replaces a result conflict region with the current side", () => {
    expect(
      replaceResultRegionWithSide(resultText, region, GIT_CONFLICT_SIDE.Current),
    ).toBe(["before", "current", "after"].join("\n"));
  });

  it("replaces a result conflict region with the incoming side", () => {
    expect(
      replaceResultRegionWithSide(resultText, region, GIT_CONFLICT_SIDE.Incoming),
    ).toBe(["before", "incoming", "after"].join("\n"));
  });

  it("replaces a result conflict region with both sides in the requested order", () => {
    expect(
      replaceResultRegionWithCombination(
        resultText,
        region,
        GIT_CONFLICT_SIDE.Incoming,
      ),
    ).toBe(["before", "incoming", "current", "after"].join("\n"));
    expect(
      replaceResultRegionWithCombination(
        resultText,
        region,
        GIT_CONFLICT_SIDE.Current,
      ),
    ).toBe(["before", "current", "incoming", "after"].join("\n"));
  });

  it("replaces a result conflict region with arbitrary candidate content", () => {
    expect(
      replaceResultRegionWithContent(resultText, region, "resolved\nlines"),
    ).toBe(["before", "resolved", "lines", "after"].join("\n"));
  });

  it("preserves CRLF line endings when replacing conflict regions", () => {
    const crlfText = resultText.replace(/\n/g, "\r\n");

    expect(
      replaceResultRegionWithContent(crlfText, region, "resolved"),
    ).toBe(["before", "resolved", "after"].join("\r\n"));
  });
});
