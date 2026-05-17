import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiffLineAnchor } from "@/features/diffs";
import {
  commentsForAnchor,
  createDraftComment,
  deleteDraftComment,
  getBranchComparisonPairKey,
  getDraftCommentAnchorKey,
  updateDraftComment,
} from "./branch-compare-comments";

const anchor: DiffLineAnchor = {
  filePath: "src/file.ts",
  hunkIdx: 0,
  lineIdx: 4,
  side: "new",
  oldLine: null,
  newLine: 12,
  kind: "Add",
};

describe("branch compare draft comments", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keys comments by comparison pair and line anchor", () => {
    const pairKey = getBranchComparisonPairKey("main", "feature/auth");

    expect(getDraftCommentAnchorKey(pairKey, anchor)).toBe(
      "main...feature/auth:src/file.ts:new::12",
    );
  });

  it("creates and finds comments for the same anchor across render modes", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const pairKey = getBranchComparisonPairKey("main", "feature/auth");
    const comment = createDraftComment(pairKey, anchor, "Looks good");

    expect(commentsForAnchor([comment], pairKey, { ...anchor })).toEqual([
      comment,
    ]);
  });

  it("updates and deletes draft comments", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const pairKey = getBranchComparisonPairKey("main", "feature/auth");
    const comment = createDraftComment(pairKey, anchor, "First");

    vi.spyOn(Date, "now").mockReturnValue(456);
    const updated = updateDraftComment([comment], comment.id, "Second");

    expect(updated[0]).toMatchObject({ body: "Second", updatedAt: 456 });
    expect(deleteDraftComment(updated, comment.id)).toEqual([]);
  });
});
