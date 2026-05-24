import { describe, expect, it } from "vitest";
import type { LocalAiBranchReviewFinding, LocalAiRunResult } from "@/shared/api/local-ai";
import { createDiffHunk, createDiffLine } from "@/test/fixtures/git";
import {
  buildAnchorIndex,
  findingKey,
  formatFindingFeedback,
  visibleBranchReviewResult,
} from "./branch-review-utils";

const finding: LocalAiBranchReviewFinding = {
  severity: "high",
  confidence: "medium",
  title: "Validate input",
  explanation: "The new branch accepts unchecked input.",
  impact: "Untrusted input can reach the branch flow.",
  recommendation: "Add validation before use.",
  suggestedComment: "Please validate this value.",
  filePath: "src/app.ts",
  side: "new",
  line: 12,
  endLine: null,
};

function branchReviewResult(
  findings: LocalAiBranchReviewFinding[],
): LocalAiRunResult {
  return {
    actionKind: "branchReview",
    modelId: "qwen",
    modelDigest: "digest",
    promptVersion: "v1",
    inputDigest: "input",
    fromCache: false,
    metadata: {
      omittedFiles: [],
      omittedSections: [],
    },
    result: {
      kind: "branchReview",
      data: {
        summary: "Review complete",
        findings,
        notes: [],
      },
    },
  };
}

describe("branch review utilities", () => {
  it("indexes added and deleted diff lines for review anchors", () => {
    const index = buildAnchorIndex({
      "src/app.ts": [
        createDiffHunk({
          lines: [
            createDiffLine({ kind: "Add", new_lineno: 12, old_lineno: null }),
            createDiffLine({ kind: "Del", old_lineno: 8, new_lineno: null }),
          ],
        }),
      ],
    });

    expect(index.get("src/app.ts:new:12")).toMatchObject({
      filePath: "src/app.ts",
      side: "new",
      lineIdx: 0,
    });
    expect(index.get("src/app.ts:old:8")).toMatchObject({
      filePath: "src/app.ts",
      side: "old",
      lineIdx: 1,
    });
  });

  it("moves unanchored findings into notes once review hunks have loaded", () => {
    const result = visibleBranchReviewResult(
      branchReviewResult([finding]),
      new Map(),
      new Set(),
      false,
    );

    expect(result?.result.kind).toBe("branchReview");
    if (result?.result.kind !== "branchReview") return;
    expect(result.result.data.findings).toEqual([]);
    expect(result.result.data.notes).toMatchObject([
      {
        title: "Validate input",
        filePath: "src/app.ts",
      },
    ]);
  });

  it("filters dismissed findings and formats copy text", () => {
    const result = visibleBranchReviewResult(
      branchReviewResult([finding]),
      new Map([["src/app.ts:new:12", {} as never]]),
      new Set([findingKey(finding)]),
      false,
    );

    expect(result?.result.kind).toBe("branchReview");
    if (result?.result.kind !== "branchReview") return;
    expect(result.result.data.findings).toEqual([]);
    expect(formatFindingFeedback(finding)).toContain("Please validate this value.");
  });
});
