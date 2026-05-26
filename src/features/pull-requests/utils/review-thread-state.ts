import type { DiffLineAnchor } from "@/features/diffs";
import type {
  ReviewComment,
  ReviewCommentAuthor,
  ReviewThread,
  ReviewThreadAnchor,
} from "../types/review-comments";

export function getReviewComparisonPairKey(baseRef: string, headRef: string) {
  return `${baseRef}...${headRef}`;
}

export function getReviewThreadAnchorKey(
  pairKey: string,
  anchor: ReviewThreadAnchor,
) {
  if (anchor.side === "file") {
    return [pairKey, anchor.filePath, anchor.side].join(":");
  }

  return [
    pairKey,
    anchor.filePath,
    anchor.side,
    anchor.oldLine ?? "",
    anchor.newLine ?? "",
  ].join(":");
}

export function createFileReviewThreadAnchor(
  filePath: string,
): ReviewThreadAnchor {
  return {
    filePath,
    side: "file",
    oldLine: null,
    newLine: null,
    kind: "File",
  };
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

export function createReviewThreadFromAnchor({
  pairKey,
  anchor,
  author,
  bodyMarkdown,
  threadId,
  parentCommentId = null,
  lifecycle = "draft",
  now = Date.now(),
}: {
  pairKey: string;
  anchor: ReviewThreadAnchor;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  threadId?: string;
  parentCommentId?: string | null;
  lifecycle?: ReviewComment["lifecycle"];
  now?: number;
}): ReviewThread {
  const resolvedThreadId =
    threadId ?? `${getReviewThreadAnchorKey(pairKey, anchor)}:${now}`;

  return {
    id: resolvedThreadId,
    providerThreadId: null,
    pairKey,
    anchor,
    status: "open",
    comments: [
      createReviewComment({
        threadId: resolvedThreadId,
        parentCommentId,
        author,
        bodyMarkdown,
        lifecycle,
        now,
        index: 0,
      }),
    ],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createReviewThread({
  pairKey,
  anchor,
  author,
  bodyMarkdown,
  parentCommentId = null,
  now = Date.now(),
}: {
  pairKey: string;
  anchor: DiffLineAnchor;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  parentCommentId?: string | null;
  now?: number;
}): ReviewThread {
  const threadAnchor = toReviewThreadAnchor(anchor);
  return createReviewThreadFromAnchor({
    pairKey,
    anchor: threadAnchor,
    author,
    bodyMarkdown,
    parentCommentId,
    now,
  });
}

export function createReviewComment({
  threadId,
  parentCommentId = null,
  author,
  bodyMarkdown,
  lifecycle = "draft",
  now = Date.now(),
  index = 0,
}: {
  threadId: string;
  parentCommentId?: string | null;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  lifecycle?: ReviewComment["lifecycle"];
  now?: number;
  index?: number;
}): ReviewComment {
  return {
    id: `${threadId}:comment:${now}:${index}`,
    threadId,
    parentCommentId,
    author,
    bodyMarkdown,
    createdAt: now,
    updatedAt: null,
    lifecycle,
    reactions: [],
    attachments: [],
  };
}

export function findReviewThreadForAnchor(
  threads: ReviewThread[],
  pairKey: string,
  anchor: ReviewThreadAnchor,
) {
  return findReviewThreadsForAnchor(threads, pairKey, anchor)[0];
}

export function findReviewThreadsForAnchor(
  threads: ReviewThread[],
  pairKey: string,
  anchor: ReviewThreadAnchor,
) {
  const anchorKey = getReviewThreadAnchorKey(pairKey, anchor);
  return threads.filter(
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
  parentCommentId = null,
  now = Date.now(),
}: {
  threads: ReviewThread[];
  pairKey: string;
  anchor: DiffLineAnchor;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  parentCommentId?: string | null;
  now?: number;
}) {
  const threadAnchor = toReviewThreadAnchor(anchor);
  const existingThread = findReviewThreadForAnchor(threads, pairKey, threadAnchor);

  if (!existingThread) {
    return [
      ...threads,
      createReviewThread({
        pairKey,
        anchor,
        author,
        bodyMarkdown,
        parentCommentId,
        now,
      }),
    ];
  }

  return addReviewThreadReply({
    threads,
    threadId: existingThread.id,
    author,
    bodyMarkdown,
    parentCommentId,
    now,
  });
}

export function upsertFileReviewThreadComment({
  threads,
  pairKey,
  filePath,
  author,
  bodyMarkdown,
  parentCommentId = null,
  now = Date.now(),
}: {
  threads: ReviewThread[];
  pairKey: string;
  filePath: string;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  parentCommentId?: string | null;
  now?: number;
}) {
  const anchor = createFileReviewThreadAnchor(filePath);
  const existingThread = findReviewThreadForAnchor(threads, pairKey, anchor);

  if (!existingThread) {
    return [
      ...threads,
      createReviewThreadFromAnchor({
        pairKey,
        anchor,
        author,
        bodyMarkdown,
        parentCommentId,
        now,
      }),
    ];
  }

  return addReviewThreadReply({
    threads,
    threadId: existingThread.id,
    author,
    bodyMarkdown,
    parentCommentId,
    now,
  });
}

export function addReviewThreadReply({
  threads,
  threadId,
  author,
  bodyMarkdown,
  parentCommentId = null,
  now = Date.now(),
}: {
  threads: ReviewThread[];
  threadId: string;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  parentCommentId?: string | null;
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
          parentCommentId,
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
