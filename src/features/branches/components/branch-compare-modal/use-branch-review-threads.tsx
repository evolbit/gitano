import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { IconPlus } from "@/shared/components/icons/icons";
import {
  type DiffInteractionContextValue,
  type DiffLineAnchor,
} from "@/features/diffs";
import type {
  LocalAiBranchReviewFinding,
  LocalAiBranchReviewResult,
} from "@/shared/api/local-ai";
import {
  addReviewThreadReply,
  createFileReviewThreadAnchor,
  createReviewComment,
  createReviewThreadFromAnchor,
  deleteReviewThreadComment,
  findReviewThreadsForAnchor,
  getReviewThreadAnchorKey,
  ReviewThreadView,
  setReviewThreadStatus,
  toReviewThreadAnchor,
  updateReviewThreadComment,
  upsertFileReviewThreadComment,
  upsertReviewThreadComment,
  type ReviewCommentAuthor,
  type ReviewThread,
  type ReviewThreadAnchor,
} from "@/features/pull-requests";
import type { GitHubPullRequestComment } from "@/shared/api/integrations";
import {
  findingAnchorKey,
  findingKey,
  formatFindingFeedback,
} from "./branch-review-utils";

const CURRENT_REVIEW_AUTHOR: ReviewCommentAuthor = {
  id: "local-current-user",
  name: "You",
  initials: "Y",
  kind: "user",
};

const GITANO_AI_AUTHOR: ReviewCommentAuthor = {
  id: "gitano-local-ai",
  name: "Gitano AI",
  initials: "AI",
  kind: "bot",
};

export function useDismissedBranchReviewFindings() {
  const [dismissedAiFindingKeys, setDismissedAiFindingKeys] = useState<
    Set<string>
  >(() => new Set());

  const resetBranchReviewFindings = useCallback(
    () => setDismissedAiFindingKeys(new Set()),
    [],
  );

  const dismissAiFinding = useCallback((finding: LocalAiBranchReviewFinding) => {
    setDismissedAiFindingKeys((current) => {
      const next = new Set(current);
      next.add(findingKey(finding));
      return next;
    });
  }, []);

  return {
    dismissAiFinding,
    dismissedAiFindingKeys,
    resetBranchReviewFindings,
  };
}

export function useBranchReviewThreads({
  branchReviewAnchorIndex,
  branchReviewData,
  dismissAiFinding,
  dismissedAiFindingKeys,
  onCopyAiFeedback,
  onResolveSubmittedReviewThread,
  pairKey,
  pullRequestComments = [],
}: {
  branchReviewAnchorIndex: Map<string, DiffLineAnchor>;
  branchReviewData: LocalAiBranchReviewResult | null;
  dismissAiFinding: (finding: LocalAiBranchReviewFinding) => void;
  dismissedAiFindingKeys: Set<string>;
  onCopyAiFeedback: (text: string) => void | Promise<void>;
  onResolveSubmittedReviewThread?: (
    threadId: string,
    resolved: boolean,
  ) => Promise<void>;
  pairKey: string;
  pullRequestComments?: GitHubPullRequestComment[];
}) {
  const [draftReviewThreads, setDraftReviewThreads] = useState<ReviewThread[]>([]);
  const [
    pendingSubmittedCommentEdits,
    setPendingSubmittedCommentEdits,
  ] = useState<Record<number, string>>({});
  const [
    reviewThreadResolutionOverrides,
    setReviewThreadResolutionOverrides,
  ] = useState<Record<string, boolean>>({});
  const [
    expandedSubmittedAnchorKeys,
    setExpandedSubmittedAnchorKeys,
  ] = useState<Set<string>>(() => new Set());
  const [activeReviewAnchor, setActiveReviewAnchor] =
    useState<DiffLineAnchor | null>(null);
  const [activeFileReviewPath, setActiveFileReviewPath] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setActiveReviewAnchor(null);
    setActiveFileReviewPath(null);
    setDraftReviewThreads([]);
    setPendingSubmittedCommentEdits({});
    setReviewThreadResolutionOverrides({});
    setExpandedSubmittedAnchorKeys(new Set());
  }, [pairKey]);

  const submittedReviewThreads = useMemo(
    () =>
      buildSubmittedReviewThreads(
        pairKey,
        pullRequestComments,
        pendingSubmittedCommentEdits,
        reviewThreadResolutionOverrides,
      ),
    [
      pairKey,
      pendingSubmittedCommentEdits,
      pullRequestComments,
      reviewThreadResolutionOverrides,
    ],
  );

  const reviewThreads = useMemo(
    () => mergeReviewThreads(submittedReviewThreads, draftReviewThreads),
    [draftReviewThreads, submittedReviewThreads],
  );

  const applyAiFinding = useCallback(
    (finding: LocalAiBranchReviewFinding) => {
      const anchor = branchReviewAnchorIndex.get(findingAnchorKey(finding));
      if (!anchor || !pairKey) return;

      setDraftReviewThreads((current) =>
        upsertReviewThreadComment({
          threads: current,
          pairKey,
          anchor,
          author: GITANO_AI_AUTHOR,
          bodyMarkdown:
            finding.suggestedComment ||
            finding.recommendation ||
            finding.explanation,
        }),
      );
      dismissAiFinding(finding);
    },
    [branchReviewAnchorIndex, dismissAiFinding, pairKey],
  );

  const beginReviewThread = useCallback((anchor: DiffLineAnchor) => {
    setActiveReviewAnchor(anchor);
    setActiveFileReviewPath(null);
  }, []);

  const beginFileReviewThread = useCallback((filePath: string) => {
    setActiveFileReviewPath(filePath);
    setActiveReviewAnchor(null);
  }, []);

  const setReviewThreadResolved = useCallback(
    (thread: ReviewThread, resolved: boolean) => {
      const threadId = thread.id;
      const providerThreadId = thread.providerThreadId ?? null;
      setReviewThreadResolutionOverrides((current) => ({
        ...current,
        [threadId]: resolved,
      }));
      setDraftReviewThreads((current) =>
        setReviewThreadStatus({
          threads: current,
          threadId,
          status: resolved ? "resolved" : "open",
        }),
      );
      if (providerThreadId && onResolveSubmittedReviewThread) {
        void onResolveSubmittedReviewThread(providerThreadId, resolved).catch(() => {
          setReviewThreadResolutionOverrides((current) => ({
            ...current,
            [threadId]: !resolved,
          }));
          setDraftReviewThreads((current) =>
            setReviewThreadStatus({
              threads: current,
              threadId,
              status: resolved ? "open" : "resolved",
            }),
          );
        });
      }
    },
    [onResolveSubmittedReviewThread],
  );

  const keepReviewThreadsExpanded = useCallback(
    (threads: ReviewThread[]) => {
      if (!pairKey || threads.length === 0) return;

      setExpandedSubmittedAnchorKeys((current) => {
        const next = new Set(current);
        threads.forEach((thread) => {
          next.add(getReviewThreadAnchorKey(pairKey, thread.anchor));
        });
        return next;
      });
    },
    [pairKey],
  );

  const renderAiFindingActions = useCallback(
    (finding: LocalAiBranchReviewFinding) => {
      const canApply = branchReviewAnchorIndex.has(findingAnchorKey(finding));
      return (
        <>
          <button
            type="button"
            className="h-7 rounded border border-border px-2 text-xs text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canApply}
            onClick={() => applyAiFinding(finding)}
          >
            Apply draft
          </button>
          <button
            type="button"
            className="h-7 rounded border border-border px-2 text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
            onClick={() => {
              void onCopyAiFeedback(formatFindingFeedback(finding));
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="h-7 rounded border border-border px-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => dismissAiFinding(finding)}
          >
            Dismiss
          </button>
        </>
      );
    },
    [
      applyAiFinding,
      branchReviewAnchorIndex,
      dismissAiFinding,
      onCopyAiFeedback,
    ],
  );

  const updateDraftOrSubmittedComment = useCallback(
    (commentId: string, bodyMarkdown: string) => {
      const githubCommentId = parseSubmittedReviewCommentId(commentId);
      if (githubCommentId) {
        const originalBody = pullRequestComments.find(
          (comment) =>
            comment.kind === "review" && comment.id === githubCommentId,
        )?.body;
        setPendingSubmittedCommentEdits((current) => {
          const next = { ...current };
          if (originalBody === bodyMarkdown) {
            delete next[githubCommentId];
            return next;
          }
          next[githubCommentId] = bodyMarkdown;
          return next;
        });
        return;
      }

      setDraftReviewThreads((current) =>
        updateReviewThreadComment({
          threads: current,
          commentId,
          bodyMarkdown,
        }),
      );
    },
    [pullRequestComments],
  );

  const interactionValue = useMemo<DiffInteractionContextValue>(() => {
    const renderLineReviewContent = (anchor: DiffLineAnchor) => {
      if (!pairKey) return null;
      const line = anchor.side === "old" ? anchor.oldLine : anchor.newLine;
      const anchorFindings =
        line === null
          ? []
          : (branchReviewData?.findings ?? []).filter(
              (finding) =>
                !dismissedAiFindingKeys.has(findingKey(finding)) &&
                findingAnchorKey(finding) ===
                  findingAnchorKey({
                    filePath: anchor.filePath,
                    side: anchor.side,
                    line,
                  }),
            );
      const threadAnchor = toReviewThreadAnchor(anchor);
      const threads = findReviewThreadsForAnchor(
        reviewThreads,
        pairKey,
        threadAnchor,
      );
      const isCreating =
        !!activeReviewAnchor &&
        threads.length === 0 &&
        getReviewThreadAnchorKey(
          pairKey,
          toReviewThreadAnchor(activeReviewAnchor),
        ) === getReviewThreadAnchorKey(pairKey, threadAnchor);

      if (!isCreating && threads.length === 0 && anchorFindings.length === 0) {
        return null;
      }

      return (
        <div className="space-y-3">
          {anchorFindings.map((finding) => (
            <div
              key={findingKey(finding)}
              className="rounded border border-blue-500/30 bg-blue-500/10 p-3 text-sm"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded border border-blue-400/40 px-1.5 py-0.5 text-[10px] uppercase text-blue-100">
                  AI review
                </span>
                <span className="font-medium text-zinc-100">
                  {finding.title}
                </span>
              </div>
              <p className="text-zinc-300">{finding.explanation}</p>
              {finding.suggestedComment ? (
                <div className="mt-2 rounded border border-border bg-background px-2 py-1.5 text-xs text-zinc-300">
                  {finding.suggestedComment}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {renderAiFindingActions(finding)}
              </div>
            </div>
          ))}
          {threads.map((thread) => (
            <ReviewThreadView
              key={thread.id}
              thread={thread}
              isCreating={false}
              currentAuthor={CURRENT_REVIEW_AUTHOR}
              onSaveInitial={() => undefined}
              onCancelInitial={() => setActiveReviewAnchor(null)}
              onReply={(_, bodyMarkdown) =>
                setDraftReviewThreads((current) =>
                  appendDraftReplyToThread({
                    current,
                    pairKey,
                    anchor: thread.anchor,
                    author: CURRENT_REVIEW_AUTHOR,
                    bodyMarkdown,
                    parentCommentId: firstSubmittedReviewCommentId(thread),
                    threadId: thread.id,
                  }),
                )
              }
              onResolveThread={(_, resolved) =>
                setReviewThreadResolved(thread, resolved)
              }
              onUpdateComment={updateDraftOrSubmittedComment}
              onDeleteComment={(commentId) => {
                setDraftReviewThreads((current) =>
                  deleteReviewThreadComment({ threads: current, commentId }),
                );
              }}
              allowSubmittedCommentEditing
              defaultCollapsed={
                thread.comments.every(
                  (comment) => comment.lifecycle === "submitted",
                ) &&
                !expandedSubmittedAnchorKeys.has(
                  getReviewThreadAnchorKey(pairKey, thread.anchor),
                )
              }
              title="Review thread"
            />
          ))}
          {isCreating ? (
            <ReviewThreadView
              thread={null}
              isCreating
              currentAuthor={CURRENT_REVIEW_AUTHOR}
              onSaveInitial={(bodyMarkdown) => {
                setDraftReviewThreads((current) =>
                  upsertReviewThreadComment({
                    threads: current,
                    pairKey,
                    anchor,
                    author: CURRENT_REVIEW_AUTHOR,
                    bodyMarkdown,
                  }),
                );
                setActiveReviewAnchor(null);
              }}
              onCancelInitial={() => setActiveReviewAnchor(null)}
              onReply={() => undefined}
              onResolveThread={() => undefined}
              onUpdateComment={updateDraftOrSubmittedComment}
              onDeleteComment={(commentId) => {
                setDraftReviewThreads((current) =>
                  deleteReviewThreadComment({ threads: current, commentId }),
                );
              }}
              allowSubmittedCommentEditing
              title="Review thread"
            />
          ) : null}
        </div>
      );
    };

    return {
      renderFileHeaderBelow: ({ filePath }) => {
        if (!pairKey) return null;
        const threadAnchor = createFileReviewThreadAnchor(filePath);
        const threads = findReviewThreadsForAnchor(
          reviewThreads,
          pairKey,
          threadAnchor,
        );
        const isCreating =
          threads.length === 0 && activeFileReviewPath === filePath;
        const isReplying = activeFileReviewPath === filePath;

        return (
          <div className="space-y-3">
            {!isCreating ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-background px-2.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => beginFileReviewThread(filePath)}
              >
                <IconPlus size={14} />
                Comment on file
              </button>
            ) : null}

            {threads.map((thread) => (
              <ReviewThreadView
                key={thread.id}
                thread={thread}
                isCreating={false}
                currentAuthor={CURRENT_REVIEW_AUTHOR}
                defaultCollapsed={
                  !isReplying &&
                  !expandedSubmittedAnchorKeys.has(
                    getReviewThreadAnchorKey(pairKey, thread.anchor),
                  ) &&
                  (!thread.comments.some(
                    (comment) => comment.lifecycle === "submitted",
                  ) ||
                    !thread.comments.some(
                      (comment) => comment.lifecycle === "draft",
                    ))
                }
                replyInitiallyOpen={isReplying}
                allowSubmittedCommentEditing
                title="File comments"
                onSaveInitial={() => undefined}
                onCancelInitial={() => setActiveFileReviewPath(null)}
                onCancelReply={() => setActiveFileReviewPath(null)}
                onReply={(_, bodyMarkdown) =>
                  setDraftReviewThreads((current) =>
                    appendDraftReplyToThread({
                      current,
                      pairKey,
                      anchor: thread.anchor,
                      author: CURRENT_REVIEW_AUTHOR,
                      bodyMarkdown,
                      parentCommentId: firstSubmittedReviewCommentId(thread),
                      threadId: thread.id,
                    }),
                  )
                }
                onResolveThread={(_, resolved) =>
                  setReviewThreadResolved(thread, resolved)
                }
                onUpdateComment={updateDraftOrSubmittedComment}
                onDeleteComment={(commentId) => {
                  setDraftReviewThreads((current) =>
                    deleteReviewThreadComment({ threads: current, commentId }),
                  );
                }}
              />
            ))}
            {isCreating ? (
              <ReviewThreadView
                thread={null}
                isCreating
                currentAuthor={CURRENT_REVIEW_AUTHOR}
                allowSubmittedCommentEditing
                title="File comments"
                onSaveInitial={(bodyMarkdown) => {
                  setDraftReviewThreads((current) =>
                    upsertFileReviewThreadComment({
                      threads: current,
                      pairKey,
                      filePath,
                      author: CURRENT_REVIEW_AUTHOR,
                      bodyMarkdown,
                    }),
                  );
                  setActiveFileReviewPath(null);
                }}
                onCancelInitial={() => setActiveFileReviewPath(null)}
                onReply={() => undefined}
                onResolveThread={() => undefined}
                onUpdateComment={updateDraftOrSubmittedComment}
                onDeleteComment={(commentId) => {
                  setDraftReviewThreads((current) =>
                    deleteReviewThreadComment({ threads: current, commentId }),
                  );
                }}
              />
            ) : null}
          </div>
        );
      },
      renderLineAccessory: (anchor) => {
        const threads = pairKey
          ? findReviewThreadsForAnchor(
              reviewThreads,
              pairKey,
              toReviewThreadAnchor(anchor),
            )
          : [];
        const commentCount = threads.reduce(
          (count, thread) => count + thread.comments.length,
          0,
        );
        return (
          <button
            type="button"
            className={`flex h-6 min-w-6 items-center justify-center rounded border text-[11px] transition-colors ${
              commentCount > 0
                ? "border-blue-500/50 bg-blue-500/20 text-blue-100"
                : "border-border bg-background text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-zinc-100"
            }`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              beginReviewThread(anchor);
            }}
            aria-label={commentCount > 0 ? "Open review thread" : "Add comment"}
          >
            {commentCount > 0 ? commentCount : <IconPlus size={13} />}
          </button>
        );
      },
      renderLineBelow: renderLineReviewContent,
      renderLineBelowFullWidth: renderLineReviewContent,
    };
  },
    [
      activeReviewAnchor,
      activeFileReviewPath,
      beginFileReviewThread,
      beginReviewThread,
      branchReviewData,
      dismissedAiFindingKeys,
      expandedSubmittedAnchorKeys,
      pairKey,
      renderAiFindingActions,
      reviewThreads,
      setReviewThreadResolved,
      updateDraftOrSubmittedComment,
    ],
  );

  return {
    clearDraftReviewThreads: () => {
      setDraftReviewThreads([]);
      setPendingSubmittedCommentEdits({});
    },
    draftReviewThreads,
    interactionValue,
    keepReviewThreadsExpanded,
    pendingSubmittedCommentEdits,
    renderAiFindingActions,
    reviewThreads,
  };
}

function buildSubmittedReviewThreads(
  pairKey: string,
  comments: GitHubPullRequestComment[],
  pendingSubmittedCommentEdits: Record<number, string>,
  reviewThreadResolutionOverrides: Record<string, boolean>,
) {
  if (!pairKey) return [];

  const threadsByRootComment = new Map<number, ReviewThread>();

  comments.forEach((comment) => {
    if (comment.kind !== "review" || !comment.path) return;
    const anchor = githubCommentAnchor(comment);
    if (!anchor) return;
    const author = githubCommentAuthor(comment);
    const now = Date.parse(comment.createdAt) || Date.now();
    const pendingEditBody = pendingSubmittedCommentEdits[comment.id];
    const bodyMarkdown = pendingEditBody ?? comment.body;
    const pendingOperation =
      pendingEditBody !== undefined ? ("edit" as const) : undefined;
    const rootCommentId = comment.inReplyToId ?? comment.id;
    const threadId = submittedReviewThreadId(rootCommentId);
    const existingThread = threadsByRootComment.get(rootCommentId);
    const resolved =
      reviewThreadResolutionOverrides[threadId] ??
      comment.reviewThreadResolved ??
      false;
    const status = resolved ? "resolved" : "open";

    if (!existingThread) {
      const thread = createReviewThreadFromAnchor({
        pairKey,
        anchor,
        author,
        bodyMarkdown,
        threadId,
        lifecycle: "submitted",
        now,
      });
      threadsByRootComment.set(rootCommentId, {
        ...thread,
        providerThreadId: comment.reviewThreadId,
        status,
        comments: [
          {
            ...thread.comments[0]!,
            id: submittedReviewCommentId(comment.id),
            pendingOperation,
            parentCommentId: comment.inReplyToId
              ? submittedReviewCommentId(comment.inReplyToId)
              : null,
          },
        ],
      });
      return;
    }

    threadsByRootComment.set(rootCommentId, {
      ...existingThread,
      providerThreadId: existingThread.providerThreadId ?? comment.reviewThreadId,
      status,
      comments: [
        ...existingThread.comments,
        {
          ...createReviewComment({
            threadId: existingThread.id,
            author,
            bodyMarkdown,
            lifecycle: "submitted",
            now,
            index: existingThread.comments.length,
          }),
          id: submittedReviewCommentId(comment.id),
          pendingOperation,
          parentCommentId: comment.inReplyToId
            ? submittedReviewCommentId(comment.inReplyToId)
            : null,
        },
      ],
      updatedAt: now,
    });
  });

  return [...threadsByRootComment.values()];
}

function submittedReviewThreadId(rootCommentId: number) {
  return `github-review-thread-${rootCommentId}`;
}

function submittedReviewCommentId(commentId: number) {
  return `github-review-comment-${commentId}`;
}

function parseSubmittedReviewCommentId(commentId: string) {
  const match = /^github-review-comment-(\d+)$/.exec(commentId);
  return match ? Number(match[1]) : null;
}

function firstSubmittedReviewCommentId(thread: ReviewThread | null) {
  return (
    thread?.comments.find(
      (comment) =>
        comment.lifecycle === "submitted" && comment.parentCommentId === null,
    )?.id ??
    thread?.comments.find((comment) => comment.lifecycle === "submitted")?.id ??
    null
  );
}

function appendDraftReplyToThread({
  current,
  pairKey,
  anchor,
  author,
  bodyMarkdown,
  parentCommentId,
  threadId,
}: {
  current: ReviewThread[];
  pairKey: string;
  anchor: ReviewThreadAnchor;
  author: ReviewCommentAuthor;
  bodyMarkdown: string;
  parentCommentId: string | null;
  threadId: string;
}) {
  if (current.some((draftThread) => draftThread.id === threadId)) {
    return addReviewThreadReply({
      threads: current,
      threadId,
      author,
      bodyMarkdown,
      parentCommentId,
    });
  }

  return [
    ...current,
    createReviewThreadFromAnchor({
      pairKey,
      anchor,
      author,
      bodyMarkdown,
      threadId,
      parentCommentId,
    }),
  ];
}

function mergeReviewThreads(
  submittedThreads: ReviewThread[],
  draftThreads: ReviewThread[],
) {
  const merged = new Map<string, ReviewThread>();

  submittedThreads.forEach((thread) => {
    merged.set(thread.id, thread);
  });

  draftThreads.forEach((thread) => {
    const existingThread = merged.get(thread.id);

    if (!existingThread) {
      merged.set(thread.id, thread);
      return;
    }

    merged.set(thread.id, {
      ...existingThread,
      comments: [...existingThread.comments, ...thread.comments],
      updatedAt: Math.max(existingThread.updatedAt, thread.updatedAt),
    });
  });

  return [...merged.values()];
}

function githubCommentAnchor(
  comment: GitHubPullRequestComment,
): ReviewThreadAnchor | null {
  if (!comment.path) return null;
  if (comment.subjectType === "file") {
    return createFileReviewThreadAnchor(comment.path);
  }

  const side = comment.side === "LEFT" ? "old" : "new";
  const line =
    side === "old"
      ? comment.originalLine ?? comment.line
      : comment.line ?? comment.originalLine;

  if (!line) {
    return createFileReviewThreadAnchor(comment.path);
  }

  return {
    filePath: comment.path,
    side,
    oldLine: side === "old" ? line : null,
    newLine: side === "new" ? line : null,
    kind: side === "old" ? "Del" : "Add",
  };
}

function githubCommentAuthor(
  comment: GitHubPullRequestComment,
): ReviewCommentAuthor {
  const login = comment.author?.login ?? "GitHub";

  return {
    id: `github-${login}`,
    name: login,
    username: login,
    avatarUrl: comment.author?.avatarUrl ?? undefined,
    initials: login.slice(0, 2).toUpperCase(),
    kind: "user",
  };
}
