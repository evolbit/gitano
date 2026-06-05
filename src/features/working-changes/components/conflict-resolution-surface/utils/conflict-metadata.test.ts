import { describe, expect, it } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_LINE_ENDING,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictFileDetail,
} from "@/shared/types/git-conflicts";
import {
  getConflictMetadataLabels,
  getConflictMetadataMessage,
} from "./conflict-metadata";

function detail(
  overrides: Partial<GitConflictFileDetail> = {},
): GitConflictFileDetail {
  return {
    path: "target.txt",
    status: ChangeType.Conflicted,
    base: null,
    current: null,
    incoming: null,
    result: {
      side: GIT_CONFLICT_SIDE.Result,
      contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
      text: "content",
      size: {
        byteSize: 7,
        lineCount: 1,
        sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
      },
      lineEnding: GIT_CONFLICT_LINE_ENDING.Lf,
      hasFinalNewline: false,
    },
    regions: [],
    conflictKinds: [GIT_CONFLICT_KIND.BothModified],
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    signatures: {
      indexSignature: "index",
      resultSignature: "result",
    },
    ...overrides,
  };
}

describe("conflict metadata", () => {
  it("describes deleted-side conflicts", () => {
    expect(
      getConflictMetadataMessage(
        detail({ conflictKinds: [GIT_CONFLICT_KIND.DeletedByIncoming] }),
      ),
    ).toContain("Incoming deleted");
  });

  it("describes binary conflicts before generic conflict kinds", () => {
    expect(
      getConflictMetadataMessage(
        detail({
          contentKind: GIT_CONFLICT_CONTENT_KIND.Binary,
          conflictKinds: [GIT_CONFLICT_KIND.Binary],
        }),
      ),
    ).toContain("Binary conflict");
  });

  it("returns fallback labels when kind metadata is missing", () => {
    expect(getConflictMetadataLabels(detail({ conflictKinds: [] }))).toEqual([
      GIT_CONFLICT_KIND.Unsupported,
    ]);
  });
});
