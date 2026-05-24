import type { DiffLineAnchor } from "@/features/diffs";
import type {
  ReviewComment,
  ReviewCommentAuthor,
  ReviewThread,
  ReviewThreadAnchor,
} from "../types";

export function getReviewComparisonPairKey(baseRef: string, headRef: string) {
  return `${baseRef}...${headRef}`;
}

export function getReviewThreadAnchorKey(
  pairKey: string,
  anchor: ReviewThreadAnchor,
) {
  return [
    pairKey,
    anchor.filePath,
    anchor.side,
    anchor.oldLine ?? "",
    anchor.newLine ?? "",
  ].join(":");
}

export function toReviewThreadAnchor(
  anchor: DiffLineAnchor,
): ReviewThreadAnchor {
  return {
    filePath: anchor.filePath,
    side: anchor.side,
    oldLine: anchor.oldLine,
    newLine: anchor.newLine,
    kind: anchor.kind,
  };
}

export function createReviewThread({
  pairKey,
  anchor,
  author,
  bodyMarkdown,
  now = Date.now(),
}: {
  pairKey: string;
  anchor: DiffLineAnchor;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  now?: number;
}): ReviewThread {
  const threadAnchor = toReviewThreadAnchor(anchor);
  const threadId = `${getReviewThreadAnchorKey(pairKey, threadAnchor)}:${now}`;

  return {
    id: threadId,
    pairKey,
    anchor: threadAnchor,
    status: "open",
    comments: [
      createReviewComment({
        threadId,
        author,
        bodyMarkdown,
        now,
        index: 0,
      }),
    ],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createReviewComment({
  threadId,
  author,
  bodyMarkdown,
  now = Date.now(),
  index = 0,
}: {
  threadId: string;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  now?: number;
  index?: number;
}): ReviewComment {
  return {
    id: `${threadId}:comment:${now}:${index}`,
    threadId,
    author,
    bodyMarkdown,
    createdAt: now,
    updatedAt: null,
    lifecycle: "draft",
    reactions: [],
    attachments: [],
  };
}

export function findReviewThreadForAnchor(
  threads: ReviewThread[],
  pairKey: string,
  anchor: ReviewThreadAnchor,
) {
  const anchorKey = getReviewThreadAnchorKey(pairKey, anchor);
  return threads.find(
    (thread) =>
      thread.pairKey === pairKey &&
      getReviewThreadAnchorKey(pairKey, thread.anchor) === anchorKey,
  );
}

export function commentsForReviewAnchor(
  threads: ReviewThread[],
  pairKey: string,
  anchor: ReviewThreadAnchor,
) {
  return findReviewThreadForAnchor(threads, pairKey, anchor)?.comments ?? [];
}

export function upsertReviewThreadComment({
  threads,
  pairKey,
  anchor,
  author,
  bodyMarkdown,
  now = Date.now(),
}: {
  threads: ReviewThread[];
  pairKey: string;
  anchor: DiffLineAnchor;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  now?: number;
}) {
  const threadAnchor = toReviewThreadAnchor(anchor);
  const existingThread = findReviewThreadForAnchor(threads, pairKey, threadAnchor);

  if (!existingThread) {
    return [
      ...threads,
      createReviewThread({ pairKey, anchor, author, bodyMarkdown, now }),
    ];
  }

  return addReviewThreadReply({
    threads,
    threadId: existingThread.id,
    author,
    bodyMarkdown,
    now,
  });
}

export function addReviewThreadReply({
  threads,
  threadId,
  author,
  bodyMarkdown,
  now = Date.now(),
}: {
  threads: ReviewThread[];
  threadId: string;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  now?: number;
}) {
  return threads.map((thread) => {
    if (thread.id !== threadId) return thread;
    return {
      ...thread,
      comments: [
        ...thread.comments,
        createReviewComment({
          threadId,
          author,
          bodyMarkdown,
          now,
          index: thread.comments.length,
        }),
      ],
      updatedAt: now,
    };
  });
}

export function updateReviewThreadComment({
  threads,
  commentId,
  bodyMarkdown,
  now = Date.now(),
}: {
  threads: ReviewThread[];
  commentId: string;
  bodyMarkdown: string;
  now?: number;
}) {
  return threads.map((thread) => {
    const hasComment = thread.comments.some((comment) => comment.id === commentId);
    if (!hasComment) return thread;
    return {
      ...thread,
      comments: thread.comments.map((comment) =>
        comment.id === commentId
          ? { ...comment, bodyMarkdown, updatedAt: now }
          : comment,
      ),
      updatedAt: now,
    };
  });
}

export function deleteReviewThreadComment({
  threads,
  commentId,
}: {
  threads: ReviewThread[];
  commentId: string;
}) {
  return threads.flatMap((thread) => {
    const comments = thread.comments.filter(
      (comment) => comment.id !== commentId,
    );
    return comments.length > 0 ? [{ ...thread, comments }] : [];
  });
}

export function setReviewThreadStatus({
  threads,
  threadId,
  status,
  now = Date.now(),
}: {
  threads: ReviewThread[];
  threadId: string;
  status: ReviewThread["status"];
  now?: number;
}) {
  return threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          status,
          updatedAt: now,
        }
      : thread,
  );
}
