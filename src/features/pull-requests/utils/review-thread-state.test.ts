import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiffLineAnchor } from "@/features/diffs";
import {
  addReviewThreadReply,
  commentsForReviewAnchor,
  deleteReviewThreadComment,
  getReviewComparisonPairKey,
  getReviewThreadAnchorKey,
  setReviewThreadStatus,
  toReviewThreadAnchor,
  updateReviewThreadComment,
  upsertReviewThreadComment,
} from "./review-thread-state";
import type { ReviewCommentAuthor } from "../types/review-comments";

const anchor: DiffLineAnchor = {
  filePath: "src/file.ts",
  hunkIdx: 0,
  lineIdx: 4,
  side: "new",
  oldLine: null,
  newLine: 12,
  kind: "Add",
};

const author: ReviewCommentAuthor = {
  id: "current-user",
  name: "Current User",
  initials: "CU",
  kind: "user",
};

describe("review thread state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keys review threads by comparison pair and line anchor", () => {
    const pairKey = getReviewComparisonPairKey("main", "feature/auth");

    expect(getReviewThreadAnchorKey(pairKey, toReviewThreadAnchor(anchor))).toBe(
      "main...feature/auth:src/file.ts:new::12",
    );
  });

  it("creates a thread and finds comments for the same anchor", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const pairKey = getReviewComparisonPairKey("main", "feature/auth");
    const threads = upsertReviewThreadComment({
      threads: [],
      pairKey,
      anchor,
      author,
      bodyMarkdown: "**Looks good**",
    });

    expect(commentsForReviewAnchor(threads, pairKey, toReviewThreadAnchor(anchor))).toHaveLength(1);
    expect(threads[0].comments[0]).toMatchObject({
      bodyMarkdown: "**Looks good**",
      lifecycle: "draft",
      createdAt: 123,
    });
  });

  it("adds replies, updates comments, and removes empty threads", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const pairKey = getReviewComparisonPairKey("main", "feature/auth");
    const threads = upsertReviewThreadComment({
      threads: [],
      pairKey,
      anchor,
      author,
      bodyMarkdown: "First",
    });

    vi.spyOn(Date, "now").mockReturnValue(456);
    const replied = addReviewThreadReply({
      threads,
      threadId: threads[0].id,
      author,
      bodyMarkdown: "Second",
    });
    const updated = updateReviewThreadComment({
      threads: replied,
      commentId: replied[0].comments[0].id,
      bodyMarkdown: "Updated",
    });
    const withoutFirst = deleteReviewThreadComment({
      threads: updated,
      commentId: updated[0].comments[0].id,
    });
    const empty = deleteReviewThreadComment({
      threads: withoutFirst,
      commentId: withoutFirst[0].comments[0].id,
    });
    const resolved = setReviewThreadStatus({
      threads: replied,
      threadId: replied[0].id,
      status: "resolved",
    });

    expect(replied[0].comments).toHaveLength(2);
    expect(resolved[0].status).toBe("resolved");
    expect(updated[0].comments[0]).toMatchObject({
      bodyMarkdown: "Updated",
      updatedAt: 456,
    });
    expect(withoutFirst[0].comments).toHaveLength(1);
    expect(empty).toEqual([]);
  });
});
