import { Split } from "@gfazioli/mantine-split-pane";
import { useMutation } from "@tanstack/react-query";
import ReactDOM from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  IconExchange,
  IconSparkles,
  IconX,
} from "@/shared/components/icons/icons";
import {
  DiffInteractionProvider,
  DiffViewerBase,
  type DiffDisplayMode,
} from "@/features/diffs";
import {
  ChangesExplorer,
  type ChangesExplorerViewMode,
} from "@/features/working-changes";
import {
  type LocalAiBranchReviewFinding,
  type LocalAiBranchReviewNote,
} from "@/shared/api/local-ai";
import { summarizeAiErrorForDisplay } from "@/shared/utils/ai-error-summary";
import { writeClipboardText } from "@/shared/platform/clipboard";
import {
  LocalAiResultModal,
  LocalAiSetupModal,
} from "@/features/local-ai";
import {
  listGitHubPullRequestComments,
  resolveGitHubPullRequestReviewThread,
  submitGitHubPullRequestReviewReply,
  submitGitHubPullRequestReview,
  updateGitHubPullRequestComment,
  type GitHubPullRequestComment,
  type GitHubPullRequestReviewCommentDraft,
} from "@/shared/api/integrations";
import { useGitActionsStore } from "@/features/repository-workspace";
import { getReviewComparisonPairKey } from "@/features/pull-requests";
import { BranchCompareBranchDropdown } from "../branch-compare-target-dropdown/branch-compare-target-dropdown";
import {
  useBranchComparisonData,
  useBranchLists,
  useBranchReviewHunks,
} from "../../hooks/use-branch-compare-data";
import {
  useBranchAiRunner,
} from "./branch-ai";
import {
  buildAnchorIndex,
  formatNoteFeedback,
  reviewResultData,
  visibleBranchReviewResult,
} from "./branch-review-utils";
import {
  useBranchReviewThreads,
  useDismissedBranchReviewFindings,
} from "./use-branch-review-threads";

type BranchCompareModalProps = {
  repoPath: string;
  initialSourceBranch: string | null;
  initialTargetBranch: string | null;
  pullRequestContext?: {
    number: number;
    title: string;
    baseRef: string;
    headRef: string;
    baseLabel: string;
    headLabel: string;
  } | null;
  onClose: () => void;
};

const DIFF_CONTEXT_LINES = 3;
const EMPTY_BRANCH_REVIEW_FINDINGS: LocalAiBranchReviewFinding[] = [];

function PullRequestCommentsProgressBar() {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-0.5 overflow-hidden bg-blue-500/10"
      role="progressbar"
      aria-label="Loading pull request comments"
    >
      <div
        className="h-full w-1/3 rounded-r bg-blue-400/90"
        style={{ animation: "panel-progress 1.1s ease-in-out infinite" }}
      />
    </div>
  );
}

function BranchAiErrorDetails({
  error,
  label,
  onCopy,
}: {
  error: string | null;
  label: string;
  onCopy: (error: string) => void;
}) {
  if (!error) return null;
  const displayError = summarizeAiErrorForDisplay(error);

  return (
    <div className="max-w-[34rem] rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-100">
      <div className="font-semibold">{label} failed</div>
      <div className="mt-1 whitespace-pre-wrap leading-5">{displayError}</div>
      <div className="mt-2">
        <button
          type="button"
          className="h-7 rounded border border-red-500/40 px-2 text-xs font-semibold text-red-50 transition-colors hover:bg-red-500/20"
          onClick={() => onCopy(error)}
        >
          Copy report data
        </button>
      </div>
    </div>
  );
}

function parseSubmittedReviewCommentId(commentId: string | null) {
  if (!commentId) return null;
  const match = /^github-review-comment-(\d+)$/.exec(commentId);
  return match ? Number(match[1]) : null;
}

export function BranchCompareModal({
  repoPath,
  initialSourceBranch,
  initialTargetBranch,
  pullRequestContext = null,
  onClose,
}: BranchCompareModalProps) {
  const setGitActionNotice = useGitActionsStore((state) => state.setNotice);
  const { mutateAsync: resolveReviewThread } = useMutation({
    mutationFn: resolveGitHubPullRequestReviewThread,
  });
  const { localBranches, remoteBranches, branchLoading, branchError } =
    useBranchLists(repoPath);
  const [sourceBranch, setSourceBranch] = useState<string | null>(
    initialSourceBranch,
  );
  const [targetBranch, setTargetBranch] = useState<string | null>(
    initialTargetBranch,
  );
  const [displayMode, setDisplayMode] =
    useState<DiffDisplayMode>("unified");
  const [viewMode, setViewMode] = useState<ChangesExplorerViewMode>("tree");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [pullRequestComments, setPullRequestComments] = useState<
    GitHubPullRequestComment[]
  >([]);
  const [pullRequestCommentsLoading, setPullRequestCommentsLoading] =
    useState(false);
  const [pullRequestCommentsError, setPullRequestCommentsError] = useState<
    string | null
  >(null);
  const [submitCommentsLoading, setSubmitCommentsLoading] = useState(false);
  const {
    dismissAiFinding,
    dismissedAiFindingKeys,
    resetBranchReviewFindings,
  } = useDismissedBranchReviewFindings();

  const notifyAiError = useCallback(
    (title: string, analysisError: unknown, expanded = false) => {
      setGitActionNotice({
        kind: "error",
        title,
        details:
          analysisError instanceof Error
            ? analysisError.message
            : String(analysisError || title),
        expanded,
      });
    },
    [setGitActionNotice],
  );

  const notifyAiSuccess = useCallback(
    (title: string, details: string) => {
      setGitActionNotice({
        kind: "success",
        title,
        details,
        expanded: false,
      });
    },
    [setGitActionNotice],
  );

  useEffect(() => {
    setSourceBranch(initialSourceBranch);
    setTargetBranch(initialTargetBranch);
  }, [initialSourceBranch, initialTargetBranch]);

  const comparisonReady = Boolean(
    sourceBranch && targetBranch && sourceBranch !== targetBranch,
  );
  const isPullRequestMode = Boolean(pullRequestContext);
  const comparisonMode = isPullRequestMode ? ("mergeBase" as const) : ("direct" as const);
  const {
    branchAiSetup,
    branchAnalysis,
    branchReview,
    closeBranchAiSetup,
    resetBranchAiAction,
    resetBranchAiRuns,
    retryBranchAiSetup,
    runBranchAiAction,
  } = useBranchAiRunner({
    comparisonMode,
    comparisonReady,
    notifyAiError,
    onReviewReset: resetBranchReviewFindings,
    repoPath,
    sourceBranch,
    targetBranch,
  });
  const {
    files,
    selectedPath,
    setSelectedPath,
    selectedFile,
    filesLoading,
    filesError,
    hunks,
    hunksLoading,
    hunksError,
  } = useBranchComparisonData({
    repoPath,
    sourceBranch,
    targetBranch,
    comparisonReady,
    comparisonMode,
    contextLines: DIFF_CONTEXT_LINES,
  });
  const pairKey = useMemo(
    () =>
      sourceBranch && targetBranch
        ? getReviewComparisonPairKey(targetBranch, sourceBranch)
        : "",
    [sourceBranch, targetBranch],
  );
  const emptyStateMessage = !sourceBranch
    ? "Select a source branch"
    : !targetBranch
      ? "Select a target branch"
      : sourceBranch === targetBranch
        ? "No changes between these branches"
        : "No changed files";
  const branchReviewData = reviewResultData(branchReview.result);
  const {
    reviewHunksByPath,
    setReviewHunksByPath,
    reviewHunksLoading,
  } = useBranchReviewHunks({
    repoPath,
    sourceBranch,
    targetBranch,
    comparisonReady,
    findings: branchReviewData?.findings ?? EMPTY_BRANCH_REVIEW_FINDINGS,
    comparisonMode,
    contextLines: DIFF_CONTEXT_LINES,
  });
  const branchReviewAnchorIndex = useMemo(
    () => buildAnchorIndex(reviewHunksByPath),
    [reviewHunksByPath],
  );
  const pullRequestCommentCountsByPath = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const comment of pullRequestComments) {
      if (comment.kind !== "review" || !comment.path) continue;
      counts[comment.path] = (counts[comment.path] ?? 0) + 1;
    }
    return counts;
  }, [pullRequestComments]);

  const visibleReviewResult = useMemo(
    () =>
      visibleBranchReviewResult(
        branchReview.result,
        branchReviewAnchorIndex,
        dismissedAiFindingKeys,
        reviewHunksLoading,
      ),
    [
      branchReview.result,
      branchReviewAnchorIndex,
      dismissedAiFindingKeys,
      reviewHunksLoading,
    ],
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    resetBranchAiRuns();
    setReviewHunksByPath({});
  }, [pairKey, resetBranchAiRuns, setReviewHunksByPath]);

  useEffect(() => {
    if (!pullRequestContext) return;

    let cancelled = false;
    setPullRequestCommentsLoading(true);
    setPullRequestCommentsError(null);
    listGitHubPullRequestComments({
      path: repoPath,
      number: pullRequestContext.number,
    })
      .then((comments) => {
        if (!cancelled) setPullRequestComments(comments);
      })
      .catch((commentError) => {
        if (!cancelled) {
          setPullRequestCommentsError(
            commentError instanceof Error
              ? commentError.message
              : String(commentError),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPullRequestCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pullRequestContext, repoPath]);

  useEffect(() => {
    if (branchReview.loading && branchReview.progressRunId) {
      setReviewHunksByPath({});
    }
  }, [branchReview.loading, branchReview.progressRunId, setReviewHunksByPath]);

  const copyAiFeedback = useCallback(
    async (text: string) => {
      try {
        await writeClipboardText(text);
        notifyAiSuccess("AI feedback copied", "Review feedback copied to the clipboard.");
      } catch (copyError) {
        notifyAiError("Copy failed", copyError);
      }
    },
    [notifyAiError, notifyAiSuccess],
  );
  const copyAiErrorReport = useCallback(
    async (text: string) => {
      try {
        await writeClipboardText(text);
        notifyAiSuccess("AI error copied", "AI error report data copied to the clipboard.");
      } catch (copyError) {
        notifyAiError("Copy failed", copyError);
      }
    },
    [notifyAiError, notifyAiSuccess],
  );

  const resolveSubmittedReviewThread = useCallback(
    async (threadId: string, resolved: boolean) => {
      if (!pullRequestContext) return;

      try {
        const threadState = await resolveReviewThread({
          path: repoPath,
          number: pullRequestContext.number,
          threadId,
          resolved,
        });
        setPullRequestComments((current) =>
          current.map((comment) =>
            comment.reviewThreadId === threadState.threadId
              ? { ...comment, reviewThreadResolved: threadState.resolved }
              : comment,
          ),
        );
        setGitActionNotice({
          kind: "success",
          title: resolved ? "Conversation resolved" : "Conversation reopened",
          details: `${resolved ? "Resolved" : "Reopened"} review conversation on pull request #${pullRequestContext.number}.`,
          expanded: false,
        });
      } catch (resolveError) {
        setGitActionNotice({
          kind: "error",
          title: resolved
            ? "Conversation not resolved"
            : "Conversation not reopened",
          details:
            resolveError instanceof Error
              ? resolveError.message
              : String(resolveError),
          expanded: false,
        });
        throw resolveError;
      }
    },
    [pullRequestContext, repoPath, resolveReviewThread, setGitActionNotice],
  );

  const {
    clearDraftReviewThreads,
    draftReviewThreads,
    interactionValue,
    pendingSubmittedCommentEdits,
    renderAiFindingActions,
  } =
    useBranchReviewThreads({
    branchReviewAnchorIndex,
    branchReviewData,
    dismissAiFinding,
    dismissedAiFindingKeys,
    onCopyAiFeedback: copyAiFeedback,
    onResolveSubmittedReviewThread: resolveSubmittedReviewThread,
    pairKey,
    pullRequestComments,
  });

  const draftReviewCommentCount = draftReviewThreads.reduce(
    (total, thread) => total + thread.comments.length,
    0,
  );
  const pendingSubmittedCommentEditCount = Object.keys(
    pendingSubmittedCommentEdits,
  ).length;
  const pendingReviewChangeCount =
    draftReviewCommentCount + pendingSubmittedCommentEditCount;

  const submitDraftComments = useCallback(async () => {
    if (!pullRequestContext || !repoPath) return;

    const comments: GitHubPullRequestReviewCommentDraft[] = [];
    const replies: Array<{ parentCommentId: number; body: string }> = [];
    const edits = Object.entries(pendingSubmittedCommentEdits).map(
      ([commentId, body]) => ({
        commentId: Number(commentId),
        body,
      }),
    );
    for (const thread of draftReviewThreads) {
      if (thread.anchor.side === "file") {
        for (const comment of thread.comments) {
          const parentCommentId = parseSubmittedReviewCommentId(
            comment.parentCommentId,
          );
          if (parentCommentId) {
            replies.push({ parentCommentId, body: comment.bodyMarkdown });
            continue;
          }

          comments.push({
            path: thread.anchor.filePath,
            body: comment.bodyMarkdown,
            subjectType: "file",
          });
        }
        continue;
      }

      const line =
        thread.anchor.side === "old"
          ? thread.anchor.oldLine
          : thread.anchor.newLine;
      if (!line) {
        setGitActionNotice({
          kind: "error",
          title: "PR comments not submitted",
          details: `Cannot submit a comment on ${thread.anchor.filePath} because its line anchor is unavailable.`,
          expanded: false,
        });
        return;
      }

      for (const comment of thread.comments) {
        const parentCommentId = parseSubmittedReviewCommentId(
          comment.parentCommentId,
        );
        if (parentCommentId) {
          replies.push({ parentCommentId, body: comment.bodyMarkdown });
          continue;
        }

        comments.push({
          path: thread.anchor.filePath,
          body: comment.bodyMarkdown,
          side: thread.anchor.side === "old" ? "LEFT" : "RIGHT",
          line,
        });
      }
    }

    if (comments.length === 0 && replies.length === 0 && edits.length === 0) {
      setGitActionNotice({
        kind: "error",
        title: "PR comments not submitted",
        details: "Add at least one draft comment before submitting.",
        expanded: false,
      });
      return;
    }

    setSubmitCommentsLoading(true);
    try {
      const submittedReplies: GitHubPullRequestComment[] = [];
      for (const reply of replies) {
        const submittedReply = await submitGitHubPullRequestReviewReply({
          path: repoPath,
          number: pullRequestContext.number,
          commentId: reply.parentCommentId,
          body: reply.body,
        });
        submittedReplies.push(submittedReply);
      }

      if (comments.length > 0) {
        await submitGitHubPullRequestReview({
          path: repoPath,
          number: pullRequestContext.number,
          event: "COMMENT",
          body: null,
          comments,
        });
      }
      const updatedComments: GitHubPullRequestComment[] = [];
      for (const edit of edits) {
        const updatedComment = await updateGitHubPullRequestComment({
          path: repoPath,
          number: pullRequestContext.number,
          kind: "review",
          commentId: edit.commentId,
          body: edit.body,
        });
        updatedComments.push(updatedComment);
      }
      if (submittedReplies.length > 0) {
        setPullRequestComments((current) => [...current, ...submittedReplies]);
      }
      if (updatedComments.length > 0) {
        setPullRequestComments((current) =>
          current.map((comment) => {
            const updatedComment = updatedComments.find(
              (nextComment) =>
                nextComment.kind === comment.kind && nextComment.id === comment.id,
            );
            return updatedComment ?? comment;
          }),
        );
      }
      clearDraftReviewThreads();
      const submittedChangeCount = comments.length + replies.length + edits.length;
      const submittedCommentCount = comments.length + replies.length;
      const submittedTitle =
        edits.length === 0
          ? `Submitted ${submittedCommentCount} review comment${submittedCommentCount === 1 ? "" : "s"}`
          : `Submitted ${submittedChangeCount} review change${submittedChangeCount === 1 ? "" : "s"}`;
      setGitActionNotice({
        kind: "success",
        title: submittedTitle,
        details: `Submitted review changes to pull request #${pullRequestContext.number}.`,
        expanded: false,
      });
    } catch (submitError) {
      setGitActionNotice({
        kind: "error",
        title: "PR comments not submitted",
        details:
          submitError instanceof Error ? submitError.message : String(submitError),
        expanded: false,
      });
    } finally {
      setSubmitCommentsLoading(false);
    }
  }, [
    clearDraftReviewThreads,
    draftReviewThreads,
    pendingSubmittedCommentEdits,
    pullRequestContext,
    repoPath,
    setGitActionNotice,
  ]);

  const renderAiNoteActions = useCallback(
    (note: LocalAiBranchReviewNote) => (
      <button
        type="button"
        className="h-7 rounded border border-border px-2 text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
        onClick={() => {
          void copyAiFeedback(formatNoteFeedback(note));
        }}
      >
        Copy
      </button>
    ),
    [copyAiFeedback],
  );

  const branchAiLoading = branchAnalysis.loading || branchReview.loading;
  const comparisonTitle = sourceBranch ?? "branch";

  const modalContent = (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-6 flex h-[96vh] w-[96vw] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {pullRequestCommentsLoading ? <PullRequestCommentsProgressBar /> : null}
        <div className="flex min-w-0 items-center justify-between border-b border-border bg-background-emphasis px-5 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isPullRequestMode && pullRequestContext ? (
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-normal text-zinc-500">
                  Pull Request #{pullRequestContext.number}
                </div>
                <div className="truncate text-sm font-semibold text-foreground">
                  {pullRequestContext.title}
                </div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">
                  {pullRequestContext.baseLabel} {"<-"}{" "}
                  {pullRequestContext.headLabel}
                </div>
              </div>
            ) : (
              <>
                <span className="text-sm font-semibold text-foreground">
                  Show changes in
                </span>
                <BranchCompareBranchDropdown
                  selectedBranch={sourceBranch}
                  localBranches={localBranches}
                  remoteBranches={remoteBranches}
                  placeholder="Select source branch"
                  loading={branchLoading}
                  error={branchError}
                  onSelectBranch={setSourceBranch}
                />
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-background text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                  title="Swap comparison direction"
                  aria-label="Swap comparison direction"
                  onClick={() => {
                    setSourceBranch(targetBranch);
                    setTargetBranch(sourceBranch);
                  }}
                >
                  <IconExchange size={16} />
                </button>
                <span className="text-sm font-semibold text-foreground">
                  against
                </span>
                <BranchCompareBranchDropdown
                  selectedBranch={targetBranch}
                  localBranches={localBranches}
                  remoteBranches={remoteBranches}
                  placeholder="Select target branch"
                  loading={branchLoading}
                  error={branchError}
                  onSelectBranch={setTargetBranch}
                />
              </>
            )}
          </div>
          <div className="ml-4 flex items-start gap-2">
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-zinc-800 px-2.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!comparisonReady || branchAiLoading}
                  onClick={() => {
                    void runBranchAiAction("analysis");
                  }}
                >
                  <IconSparkles size={14} />
                  {branchAnalysis.loading ? "Analyzing" : "Analyze"}
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-zinc-800 px-2.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!comparisonReady || branchAiLoading}
                  onClick={() => {
                    void runBranchAiAction("review");
                  }}
                >
                  <IconSparkles size={14} />
                  {branchReview.loading ? "Reviewing" : "Review"}
                </button>
                {isPullRequestMode ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-zinc-800 px-2.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700"
                      onClick={() => setCommentsOpen((current) => !current)}
                    >
                      Comments
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-blue-500/50 bg-blue-500/20 px-2.5 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        submitCommentsLoading || pendingReviewChangeCount === 0
                      }
                      onClick={() => {
                        void submitDraftComments();
                      }}
                    >
                      {submitCommentsLoading ? "Submitting" : "Submit comments"}
                    </button>
                  </>
                ) : null}
              </div>
              <BranchAiErrorDetails
                label="Analyze"
                error={branchAnalysis.error}
                onCopy={(error) => {
                  void copyAiErrorReport(error);
                }}
              />
              <BranchAiErrorDetails
                label="Review"
                error={branchReview.error}
                onCopy={(error) => {
                  void copyAiErrorReport(error);
                }}
              />
            </div>
            <button
              type="button"
              className="rounded p-2 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={22} />
            </button>
          </div>
        </div>

        {filesError ? (
          <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {filesError}
          </div>
        ) : null}

        <Split className="flex h-full min-h-0 w-full flex-1">
          <Split.Pane initialWidth={360} minWidth={260} maxWidth={540}>
            <ChangesExplorer
              files={files}
              selectedPath={selectedPath}
              onSelectFile={(file) => setSelectedPath(file.path)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showFileCheckboxes={false}
              surface="main"
              showHeader
              sectionMode="single"
              isLoading={filesLoading}
              emptyStateMessage={emptyStateMessage}
              fileCommentCounts={pullRequestCommentCountsByPath}
            />
          </Split.Pane>
          <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
          <Split.Pane grow className="min-h-0 bg-background">
            {selectedFile ? (
              <DiffInteractionProvider value={interactionValue}>
                <DiffViewerBase
                  filePath={selectedFile.path}
                  hunks={hunks}
                  loading={hunksLoading}
                  error={hunksError}
                  displayMode={displayMode}
                  onDisplayModeChange={setDisplayMode}
                />
              </DiffInteractionProvider>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {filesLoading ? "Loading files..." : emptyStateMessage}
              </div>
            )}
          </Split.Pane>
          {commentsOpen && isPullRequestMode ? (
            <>
              <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
              <Split.Pane initialWidth={360} minWidth={280} maxWidth={520}>
                <div className="flex h-full min-h-0 flex-col border-l border-border bg-background">
                  <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-border bg-background-emphasis px-3">
                    <div className="text-xs font-semibold uppercase tracking-normal text-zinc-500">
                      Comments
                    </div>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                      onClick={() => setCommentsOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
                    {pullRequestCommentsLoading ? (
                      <div className="rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-300">
                        Loading comments...
                      </div>
                    ) : null}
                    {pullRequestCommentsError ? (
                      <div
                        role="alert"
                        className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100"
                      >
                        {pullRequestCommentsError}
                      </div>
                    ) : null}
                    {!pullRequestCommentsLoading &&
                    !pullRequestCommentsError &&
                    pullRequestComments.length === 0 ? (
                      <div className="rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-400">
                        No comments.
                      </div>
                    ) : null}
                    {pullRequestComments.map((comment) => (
                      <div
                        key={`${comment.kind}-${comment.id}`}
                        className="rounded border border-border bg-background-emphasis p-3 text-xs"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-100">
                            {comment.author?.login ?? "Unknown"}
                          </span>
                          <span className="uppercase text-zinc-500">
                            {comment.kind}
                          </span>
                        </div>
                        {comment.path ? (
                          <div className="mb-2 truncate text-[11px] text-zinc-500">
                            {comment.path}
                            {comment.line && comment.subjectType !== "file"
                              ? `:${comment.line}`
                              : ""}
                          </div>
                        ) : null}
                        <div className="whitespace-pre-wrap leading-5 text-zinc-300">
                          {pendingSubmittedCommentEdits[comment.id] ?? comment.body}
                        </div>
                        {pendingSubmittedCommentEdits[comment.id] !== undefined ? (
                          <div className="mt-2 text-[11px] font-semibold text-blue-200">
                            Draft edit
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </Split.Pane>
            </>
          ) : null}
        </Split>
        <LocalAiResultModal
          open={
            Boolean(branchAnalysis.result) ||
            branchAnalysis.loading ||
            Boolean(branchAnalysis.error)
          }
          title={`Analyze ${comparisonTitle}`}
          result={branchAnalysis.result}
          loading={branchAnalysis.loading}
          error={branchAnalysis.error}
          progress={branchAnalysis.progress}
          externalEvents={branchAnalysis.externalEvents}
          showChangedAreas={false}
          onRefresh={() => {
            void runBranchAiAction("analysis", true);
          }}
          onClose={() => {
            resetBranchAiAction("analysis");
          }}
        />
        <LocalAiResultModal
          open={
            Boolean(visibleReviewResult) ||
            branchReview.loading ||
            Boolean(branchReview.error)
          }
          title={`Review ${comparisonTitle}`}
          result={visibleReviewResult}
          loading={branchReview.loading}
          error={branchReview.error}
          progress={branchReview.progress}
          externalEvents={branchReview.externalEvents}
          renderBranchReviewFindingActions={(finding) =>
            renderAiFindingActions(finding)
          }
          renderBranchReviewNoteActions={(note) => renderAiNoteActions(note)}
          onRefresh={() => {
            void runBranchAiAction("review", true);
          }}
          onClose={() => {
            resetBranchAiAction("review");
            setReviewHunksByPath({});
          }}
        />
        <LocalAiSetupModal
          open={Boolean(branchAiSetup)}
          actionKind={branchAiSetup?.actionKind ?? null}
          setupReason={branchAiSetup?.reason ?? null}
          onClose={closeBranchAiSetup}
          onReady={retryBranchAiSetup}
        />
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
