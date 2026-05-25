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
  deleteReviewThreadComment,
  findReviewThreadForAnchor,
  getReviewThreadAnchorKey,
  ReviewThreadView,
  setReviewThreadStatus,
  toReviewThreadAnchor,
  updateReviewThreadComment,
  upsertReviewThreadComment,
  type ReviewCommentAuthor,
  type ReviewThread,
} from "@/features/review-comments";
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
  pairKey,
}: {
  branchReviewAnchorIndex: Map<string, DiffLineAnchor>;
  branchReviewData: LocalAiBranchReviewResult | null;
  dismissAiFinding: (finding: LocalAiBranchReviewFinding) => void;
  dismissedAiFindingKeys: Set<string>;
  onCopyAiFeedback: (text: string) => void | Promise<void>;
  pairKey: string;
}) {
  const [reviewThreads, setReviewThreads] = useState<ReviewThread[]>([]);
  const [activeReviewAnchor, setActiveReviewAnchor] =
    useState<DiffLineAnchor | null>(null);

  useEffect(() => {
    setActiveReviewAnchor(null);
  }, [pairKey]);

  const applyAiFinding = useCallback(
    (finding: LocalAiBranchReviewFinding) => {
      const anchor = branchReviewAnchorIndex.get(findingAnchorKey(finding));
      if (!anchor || !pairKey) return;

      setReviewThreads((current) =>
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
  }, []);

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

  const interactionValue = useMemo<DiffInteractionContextValue>(
    () => ({
      renderLineAccessory: (anchor) => {
        const thread = pairKey
          ? findReviewThreadForAnchor(
              reviewThreads,
              pairKey,
              toReviewThreadAnchor(anchor),
            )
          : undefined;
        const commentCount = thread?.comments.length ?? 0;
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
      renderLineBelowFullWidth: (anchor) => {
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
        const thread =
          findReviewThreadForAnchor(reviewThreads, pairKey, threadAnchor) ??
          null;
        const isCreating =
          !!activeReviewAnchor &&
          !thread &&
          getReviewThreadAnchorKey(
            pairKey,
            toReviewThreadAnchor(activeReviewAnchor),
          ) === getReviewThreadAnchorKey(pairKey, threadAnchor);

        if (!isCreating && !thread && anchorFindings.length === 0) return null;

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
            {thread || isCreating ? (
              <ReviewThreadView
                thread={thread}
                isCreating={isCreating}
                currentAuthor={CURRENT_REVIEW_AUTHOR}
                onSaveInitial={(bodyMarkdown) => {
                  setReviewThreads((current) =>
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
                onReply={(threadId, bodyMarkdown) =>
                  setReviewThreads((current) =>
                    addReviewThreadReply({
                      threads: current,
                      threadId,
                      author: CURRENT_REVIEW_AUTHOR,
                      bodyMarkdown,
                    }),
                  )
                }
                onResolveThread={(threadId, resolved) =>
                  setReviewThreads((current) =>
                    setReviewThreadStatus({
                      threads: current,
                      threadId,
                      status: resolved ? "resolved" : "open",
                    }),
                  )
                }
                onUpdateComment={(commentId, bodyMarkdown) =>
                  setReviewThreads((current) =>
                    updateReviewThreadComment({
                      threads: current,
                      commentId,
                      bodyMarkdown,
                    }),
                  )
                }
                onDeleteComment={(commentId) => {
                  setReviewThreads((current) =>
                    deleteReviewThreadComment({ threads: current, commentId }),
                  );
                }}
              />
            ) : null}
          </div>
        );
      },
    }),
    [
      activeReviewAnchor,
      beginReviewThread,
      branchReviewData,
      dismissedAiFindingKeys,
      pairKey,
      renderAiFindingActions,
      reviewThreads,
    ],
  );

  return {
    interactionValue,
    renderAiFindingActions,
    reviewThreads,
  };
}
