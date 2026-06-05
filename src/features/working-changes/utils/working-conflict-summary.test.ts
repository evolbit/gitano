import { describe, expect, it } from "vitest";
import { ChangeType, type WorkingChangeFileSummary } from "@/shared/types/git";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictSummary,
} from "@/shared/types/git-conflicts";
import {
  conflictSummaryToWorkingFile,
  mergeWorkingChangeSummaries,
} from "./working-conflict-summary";

function conflictSummary(
  overrides: Partial<GitConflictSummary> = {},
): GitConflictSummary {
  return {
    path: "src/conflict.ts",
    status: ChangeType.Conflicted,
    conflictCount: 1,
    conflictKinds: [GIT_CONFLICT_KIND.BothModified],
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    size: {
      byteSize: 100,
      lineCount: 10,
      sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
    },
    fileSignature: "conflict-signature",
    ...overrides,
  };
}

function changeSummary(
  overrides: Partial<WorkingChangeFileSummary> = {},
): WorkingChangeFileSummary {
  return {
    path: "src/normal.ts",
    status: ChangeType.Modified,
    insertions: 1,
    deletions: 1,
    isUntracked: false,
    fileSignature: "normal-signature",
    ...overrides,
  };
}

describe("working conflict summary mapping", () => {
  it("adapts a conflict summary into an explorer file row", () => {
    expect(conflictSummaryToWorkingFile(conflictSummary())).toMatchObject({
      path: "src/conflict.ts",
      status: ChangeType.Conflicted,
      insertions: 0,
      deletions: 0,
      isUntracked: false,
      conflictCount: 1,
    });
  });

  it("places conflicts first and removes duplicate normal summaries by path", () => {
    const summaries = mergeWorkingChangeSummaries(
      [
        changeSummary({ path: "src/conflict.ts" }),
        changeSummary({ path: "src/normal.ts" }),
      ],
      [conflictSummary()],
    );

    expect(summaries.map((summary) => summary.path)).toEqual([
      "src/conflict.ts",
      "src/normal.ts",
    ]);
    expect(summaries[0].status).toBe(ChangeType.Conflicted);
  });
});
