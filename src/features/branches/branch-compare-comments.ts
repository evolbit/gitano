import type { DiffLineAnchor } from "@/features/diffs";

export type DraftDiffComment = {
  id: string;
  pairKey: string;
  filePath: string;
  side: DiffLineAnchor["side"];
  oldLine: number | null;
  newLine: number | null;
  body: string;
  updatedAt: number;
};

export function getBranchComparisonPairKey(baseRef: string, headRef: string) {
  return `${baseRef}...${headRef}`;
}

export function getDraftCommentAnchorKey(
  pairKey: string,
  anchor: Pick<
    DiffLineAnchor,
    "filePath" | "side" | "oldLine" | "newLine"
  >,
) {
  return [
    pairKey,
    anchor.filePath,
    anchor.side,
    anchor.oldLine ?? "",
    anchor.newLine ?? "",
  ].join(":");
}

export function createDraftComment(
  pairKey: string,
  anchor: DiffLineAnchor,
  body: string,
): DraftDiffComment {
  return {
    id: `${getDraftCommentAnchorKey(pairKey, anchor)}:${Date.now()}`,
    pairKey,
    filePath: anchor.filePath,
    side: anchor.side,
    oldLine: anchor.oldLine,
    newLine: anchor.newLine,
    body,
    updatedAt: Date.now(),
  };
}

export function updateDraftComment(
  comments: DraftDiffComment[],
  commentId: string,
  body: string,
) {
  return comments.map((comment) =>
    comment.id === commentId
      ? {
          ...comment,
          body,
          updatedAt: Date.now(),
        }
      : comment,
  );
}

export function deleteDraftComment(
  comments: DraftDiffComment[],
  commentId: string,
) {
  return comments.filter((comment) => comment.id !== commentId);
}

export function commentsForAnchor(
  comments: DraftDiffComment[],
  pairKey: string,
  anchor: DiffLineAnchor,
) {
  const anchorKey = getDraftCommentAnchorKey(pairKey, anchor);

  return comments.filter(
    (comment) =>
      getDraftCommentAnchorKey(pairKey, comment) === anchorKey &&
      comment.pairKey === pairKey,
  );
}
