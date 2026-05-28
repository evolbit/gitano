import { Split } from "@gfazioli/mantine-split-pane";
import { Popover } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactDOM from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  IconChevronDown,
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
  mergeProviderPullRequest,
  listProviderIntegrations,
  listGitHubPullRequestComments,
  listProviderPullRequestCommits,
  resolveGitHubPullRequestReviewThread,
  submitGitHubPullRequestReviewReply,
  submitGitHubPullRequestReview,
  submitProviderPullRequestConversationComment,
  updateGitHubPullRequestComment,
  type GitHubPullRequestComment,
  type GitHubPullRequestReviewCommentDraft,
  type PullRequestCommit,
  type PullRequestListItem,
  type PullRequestReviewEvent,
} from "@/shared/api/integrations";
import { MarkdownComposer } from "@/shared/components/markdown-composer/markdown-composer";
import { PullRequestHistory } from "@/shared/components/pull-request-history/pull-request-history";
import { PullRequestMergeAction } from "@/shared/components/pull-request-merge-action/pull-request-merge-action";
import { PullRequestMergeDecisionModal } from "@/shared/components/pull-request-merge-decision-modal/pull-request-merge-decision-modal";
import { usePullRequestMergeMethods } from "@/shared/hooks/use-pull-request-merge-methods";
import type {
  PullRequestReviewDecision,
  PullRequestReviewDecisionPayload,
} from "@/shared/types/pull-requests";
import { getReviewComparisonPairKey } from "@/shared/lib/pull-requests/review-comparison";
import { useGitActionsStore } from "@/features/repository-workspace";
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
    pullRequest?: PullRequestListItem;
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
const REVIEW_SEND_OPTIONS: Array<{
  event: PullRequestReviewEvent;
  label: string;
  description: string;
}> = [
  {
    event: "COMMENT",
    label: "Comment",
    description: "Publish pending comments without changing review state.",
  },
  {
    event: "APPROVE",
    label: "Approve",
    description: "Publish comments and approve the pull request.",
  },
  {
    event: "REQUEST_CHANGES",
    label: "Request changes",
    description: "Submit feedback suggesting changes.",
  },
];

function PullRequestHistoryProgressBar() {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-0.5 overflow-hidden bg-blue-500/10"
      role="progressbar"
      aria-label="Loading pull request history"
    >
      <div
        className="h-full w-1/3 rounded-r bg-blue-400/90"
        style={{ animation: "panel-progress 1.1s ease-in-out infinite" }}
      />
    </div>
  );
}

function reviewSuccessTitle(event: PullRequestReviewEvent, count: number) {
  switch (event) {
    case "APPROVE":
      return "Approved pull request";
    case "REQUEST_CHANGES":
      return "Requested changes";
    case "COMMENT":
    default:
      return `Submitted ${count} review comment${count === 1 ? "" : "s"}`;
  }
}

function reviewSuccessDetails(event: PullRequestReviewEvent, number: number) {
  switch (event) {
    case "APPROVE":
      return `Approved pull request #${number}.`;
    case "REQUEST_CHANGES":
      return `Requested changes on pull request #${number}.`;
    case "COMMENT":
    default:
      return `Submitted review changes to pull request #${number}.`;
  }
}

function reviewSubmissionErrorTitle(event: PullRequestReviewEvent) {
  switch (event) {
    case "APPROVE":
      return "Pull request not approved";
    case "REQUEST_CHANGES":
      return "Changes not requested";
    case "COMMENT":
    default:
      return "PR comments not submitted";
  }
}

function requiresReviewSummary(event: PullRequestReviewEvent) {
  return event === "REQUEST_CHANGES";
}

function FinishReviewDropdown({
  body,
  disableReviewDecisions,
  error,
  event,
  pendingChangeCount,
  submitting,
  onBodyChange,
  onCancel,
  onEventChange,
  onSubmit,
}: {
  body: string;
  error: string | null;
  event: PullRequestReviewEvent;
  disableReviewDecisions: boolean;
  pendingChangeCount: number;
  submitting: boolean;
  onBodyChange: (body: string) => void;
  onCancel: () => void;
  onEventChange: (event: PullRequestReviewEvent) => void;
  onSubmit: () => void;
}) {
  const trimmedBody = body.trim();
  const selectedActionDisabled =
    disableReviewDecisions && event !== "COMMENT";
  const canSubmit =
    !submitting &&
    !selectedActionDisabled &&
    (event === "APPROVE" ||
      trimmedBody.length > 0 ||
      (event === "COMMENT" && pendingChangeCount > 0));

  return (
    <div
      role="dialog"
      aria-label="Finish your review"
      className="w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border bg-background-emphasis px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Finish your review
        </h3>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
          aria-label="Close finish review"
          onClick={onCancel}
        >
          <IconX size={18} />
        </button>
      </div>
      <div className="space-y-4 px-4 py-4">
        <textarea
          value={body}
          onChange={(changeEvent) => onBodyChange(changeEvent.target.value)}
          className="min-h-40 w-full resize-y rounded border border-border bg-background-emphasis px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-500"
          placeholder="Leave a comment"
          autoFocus
        />
        {error ? (
          <div
            role="alert"
            className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100"
          >
            {error}
          </div>
        ) : null}
        <div className="space-y-3">
          {REVIEW_SEND_OPTIONS.map((option) => {
            const optionDisabled =
              disableReviewDecisions && option.event !== "COMMENT";
            return (
              <label
                key={option.event}
                className={`flex items-start gap-3 text-sm ${
                  optionDisabled
                    ? "cursor-not-allowed opacity-45"
                    : "cursor-pointer"
                }`}
              >
                <input
                  type="radio"
                  aria-label={option.label}
                  className="mt-1 h-4 w-4 accent-blue-500"
                  checked={event === option.event}
                  disabled={optionDisabled}
                  onChange={() => onEventChange(option.event)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {optionDisabled
                      ? "Unavailable because you authored this pull request."
                      : option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border bg-background-emphasis px-4 py-3">
        <button
          type="button"
          className="rounded border border-border px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          aria-label="Submit review"
          className="rounded bg-lime-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {submitting ? "Submitting" : "Submit review"}
        </button>
      </div>
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

function pullRequestRefNameFromLabel(label: string, fallback: string) {
  const [, refName] = label.split(":");
  if (refName) return refName;

  return fallback
    .replace(/^refs\/remotes\/[^/]+\//, "")
    .replace(/^refs\/heads\//, "");
}

function pullRequestListItemFromContext(
  context: NonNullable<BranchCompareModalProps["pullRequestContext"]>,
): PullRequestListItem {
  if (context.pullRequest) return context.pullRequest;

  return {
    number: context.number,
    title: context.title,
    body: null,
    state: "open",
    draft: false,
    htmlUrl: "",
    user: null,
    base: {
      label: context.baseLabel,
      refName: pullRequestRefNameFromLabel(context.baseLabel, context.baseRef),
      sha: "",
      repositoryFullName: null,
    },
    head: {
      label: context.headLabel,
      refName: pullRequestRefNameFromLabel(context.headLabel, context.headRef),
      sha: "",
      repositoryFullName: null,
    },
    createdAt: "",
    updatedAt: "",
  };
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
  const { mutateAsync: mergePullRequest } = useMutation({
    mutationFn: mergeProviderPullRequest,
  });
  const { mutateAsync: submitConversationComment } = useMutation({
    mutationFn: submitProviderPullRequestConversationComment,
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pullRequestComments, setPullRequestComments] = useState<
    GitHubPullRequestComment[]
  >([]);
  const [pullRequestCommentsLoading, setPullRequestCommentsLoading] =
    useState(false);
  const [pullRequestCommentsError, setPullRequestCommentsError] = useState<
    string | null
  >(null);
  const [submitCommentsLoading, setSubmitCommentsLoading] = useState(false);
  const [conversationCommentBody, setConversationCommentBody] = useState("");
  const [conversationCommentSubmitting, setConversationCommentSubmitting] =
    useState(false);
  const [finishReviewOpen, setFinishReviewOpen] = useState(false);
  const [finishReviewEvent, setFinishReviewEvent] =
    useState<PullRequestReviewEvent>("COMMENT");
  const [finishReviewBody, setFinishReviewBody] = useState("");
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(
    null,
  );
  const [mergeDecision, setMergeDecision] =
    useState<PullRequestReviewDecision | null>(null);
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
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
  const pullRequestForReview = useMemo(
    () =>
      pullRequestContext
        ? pullRequestListItemFromContext(pullRequestContext)
        : null,
    [pullRequestContext],
  );
  const providerIntegrationsQuery = useQuery({
    queryKey: ["provider-integrations"],
    queryFn: listProviderIntegrations,
    enabled: isPullRequestMode,
    staleTime: 30_000,
  });
  const currentGitHubLogin = useMemo(() => {
    const githubProvider = providerIntegrationsQuery.data?.find(
      (provider) => provider.id === "github",
    );
    return githubProvider?.connection?.accountLogin ?? null;
  }, [providerIntegrationsQuery.data]);
  const currentGitHubUser = useMemo(() => {
    const githubProvider = providerIntegrationsQuery.data?.find(
      (provider) => provider.id === "github",
    );
    const connection = githubProvider?.connection;
    return connection
      ? { login: connection.accountLogin, avatarUrl: connection.avatarUrl }
      : null;
  }, [providerIntegrationsQuery.data]);
  const reviewDecisionDisabledForAuthor = Boolean(
    currentGitHubLogin &&
      pullRequestForReview?.user?.login &&
      currentGitHubLogin.toLowerCase() ===
        pullRequestForReview.user.login.toLowerCase(),
  );
  const {
    mergeMethods,
    mergeOptionsLoading,
    selectedMergeMethod,
    setSelectedMergeMethod,
  } = usePullRequestMergeMethods({
    enabled: isPullRequestMode,
    repoPath,
  });
  const pullRequestHistoryCommitsQuery = useQuery({
    queryKey: [
      "provider-pull-request-commits",
      "github",
      repoPath,
      pullRequestContext?.number ?? null,
    ],
    queryFn: () =>
      listProviderPullRequestCommits({
        providerId: "github",
        path: repoPath,
        number: pullRequestContext?.number ?? 0,
      }),
    enabled: historyOpen && isPullRequestMode && Boolean(pullRequestContext),
    staleTime: 30_000,
  });
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

  const loadPullRequestComments = useCallback(async () => {
    if (!pullRequestContext) return [];

    setPullRequestCommentsLoading(true);
    setPullRequestCommentsError(null);
    try {
      const comments = await listGitHubPullRequestComments({
        path: repoPath,
        number: pullRequestContext.number,
      });
      setPullRequestComments(comments);
      return comments;
    } catch (commentError) {
      const details =
        commentError instanceof Error
          ? commentError.message
          : String(commentError);
      setPullRequestCommentsError(details);
      throw commentError;
    } finally {
      setPullRequestCommentsLoading(false);
    }
  }, [pullRequestContext, repoPath]);

  useEffect(() => {
    if (!pullRequestContext) {
      setPullRequestComments([]);
      setPullRequestCommentsError(null);
      setPullRequestCommentsLoading(false);
      return;
    }

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
    keepReviewThreadsExpanded,
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

  const submitDraftComments = useCallback(async (
    event: PullRequestReviewEvent,
    body: string | null,
  ) => {
    if (!pullRequestContext || !repoPath) return;
    const reviewBody = body?.trim() || null;

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

    if (
      event === "COMMENT" &&
      comments.length === 0 &&
      replies.length === 0 &&
      edits.length === 0 &&
      !reviewBody
    ) {
      const details = "Add at least one comment before submitting a review.";
      setReviewSubmitError(details);
      return;
    }

    if (requiresReviewSummary(event) && !reviewBody) {
      const details = "Add a review summary before requesting changes.";
      setReviewSubmitError(details);
      return;
    }

    setSubmitCommentsLoading(true);
    setReviewSubmitError(null);
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

      if (comments.length > 0 || event !== "COMMENT" || reviewBody) {
        await submitGitHubPullRequestReview({
          path: repoPath,
          number: pullRequestContext.number,
          event,
          body: reviewBody,
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

      if (comments.length > 0) {
        keepReviewThreadsExpanded(draftReviewThreads);
        try {
          await loadPullRequestComments();
        } catch (refreshError) {
          setGitActionNotice({
            kind: "error",
            title: "PR comments submitted",
            details:
              refreshError instanceof Error
                ? `GitHub accepted the review, but Gitano could not refresh the comments: ${refreshError.message}`
                : `GitHub accepted the review, but Gitano could not refresh the comments: ${String(refreshError)}`,
            expanded: false,
          });
          return;
        }
      }

      clearDraftReviewThreads();
      setFinishReviewOpen(false);
      setFinishReviewBody("");
      setFinishReviewEvent("COMMENT");
      const submittedChangeCount =
        comments.length + replies.length + edits.length + (reviewBody ? 1 : 0);
      const submittedTitle =
        event === "COMMENT" &&
        edits.length > 0 &&
        comments.length === 0 &&
        replies.length === 0
          ? `Submitted ${submittedChangeCount} review change${submittedChangeCount === 1 ? "" : "s"}`
          : reviewSuccessTitle(event, submittedChangeCount);
      setGitActionNotice({
        kind: "success",
        title: submittedTitle,
        details: reviewSuccessDetails(event, pullRequestContext.number),
        expanded: false,
      });
    } catch (submitError) {
      const details =
        submitError instanceof Error ? submitError.message : String(submitError);
      setReviewSubmitError(details);
      setGitActionNotice({
        kind: "error",
        title: reviewSubmissionErrorTitle(event),
        details,
        expanded: false,
      });
    } finally {
      setSubmitCommentsLoading(false);
    }
  }, [
    clearDraftReviewThreads,
    draftReviewThreads,
    keepReviewThreadsExpanded,
    loadPullRequestComments,
    pendingSubmittedCommentEdits,
    pullRequestContext,
    repoPath,
    setGitActionNotice,
  ]);

  const submitMergeDecision = useCallback(
    async (payload: PullRequestReviewDecisionPayload) => {
      if (!mergeDecision || !pullRequestContext || !repoPath) return;

      setMergeSubmitting(true);
      setMergeError(null);
      try {
        await mergePullRequest({
          providerId: "github",
          path: repoPath,
          number: pullRequestContext.number,
          mergeMethod: mergeDecision.mergeMethod ?? selectedMergeMethod,
          title: payload.title,
          body: payload.body,
        });
        setMergeDecision(null);
        setMergeError(null);
        setGitActionNotice({
          kind: "success",
          title: `Merged #${pullRequestContext.number}`,
          details: `Merged pull request #${pullRequestContext.number}.`,
          expanded: false,
        });
      } catch (mergeError) {
        const details =
          mergeError instanceof Error ? mergeError.message : String(mergeError);
        setMergeError(details);
        setGitActionNotice({
          kind: "error",
          title: "Pull request not merged",
          details,
          expanded: false,
        });
      } finally {
        setMergeSubmitting(false);
      }
    },
    [
      mergeDecision,
      mergePullRequest,
      pullRequestContext,
      repoPath,
      selectedMergeMethod,
      setGitActionNotice,
    ],
  );

  const submitConversationCommentDraft = useCallback(async () => {
    if (!pullRequestContext) return;
    const body = conversationCommentBody.trim();
    if (!body) return;

    setConversationCommentSubmitting(true);
    try {
      const comment = await submitConversationComment({
        providerId: "github",
        path: repoPath,
        number: pullRequestContext.number,
        body,
      });
      setPullRequestComments((current) => [...current, comment]);
      setConversationCommentBody("");
      setGitActionNotice({
        kind: "success",
        title: "Comment added",
        details: `Added a comment to pull request #${pullRequestContext.number}.`,
        expanded: false,
      });
    } catch (commentError) {
      const details =
        commentError instanceof Error ? commentError.message : String(commentError);
      setGitActionNotice({
        kind: "error",
        title: "Comment not added",
        details,
        expanded: false,
      });
    } finally {
      setConversationCommentSubmitting(false);
    }
  }, [
    conversationCommentBody,
    pullRequestContext,
    repoPath,
    setGitActionNotice,
    submitConversationComment,
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
  const pullRequestHistoryCommits =
    (pullRequestHistoryCommitsQuery.data as PullRequestCommit[] | undefined) ??
    [];
  const pullRequestHistoryError =
    pullRequestCommentsError ??
    (pullRequestHistoryCommitsQuery.error instanceof Error
      ? pullRequestHistoryCommitsQuery.error.message
      : pullRequestHistoryCommitsQuery.error
        ? String(pullRequestHistoryCommitsQuery.error)
        : null);
  const pullRequestHistoryLoading =
    pullRequestCommentsLoading || pullRequestHistoryCommitsQuery.isLoading;

  const modalContent = (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-6 flex h-[96vh] w-[96vw] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {pullRequestHistoryLoading ? <PullRequestHistoryProgressBar /> : null}
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
                    {pullRequestForReview ? (
                      <PullRequestMergeAction
                        mergeMethods={mergeMethods}
                        mergeOptionsLoading={mergeOptionsLoading}
                        selectedMergeMethod={selectedMergeMethod}
                        onMergeMethodChange={setSelectedMergeMethod}
                        onMerge={() => {
                          setMergeError(null);
                          setMergeDecision({
                            pullRequest: pullRequestForReview,
                            event: "MERGE",
                            mergeMethod: selectedMergeMethod,
                          });
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-semibold transition-colors ${
                        historyOpen
                          ? "border-blue-500/50 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30"
                          : "border-border bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                      }`}
                      onClick={() => setHistoryOpen((current) => !current)}
                    >
                      Conversation
                    </button>
                    <Popover
                      opened={finishReviewOpen}
                      onChange={(opened) => {
                        setFinishReviewOpen(opened);
                        if (!opened) {
                          setReviewSubmitError(null);
                        }
                      }}
                      position="bottom-end"
                      offset={8}
                      shadow="xl"
                      transitionProps={{ duration: 0 }}
                      withinPortal
                      hideDetached={false}
                      zIndex={10080}
                    >
                      <Popover.Target>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-lime-500/50 bg-lime-500/20 px-2.5 text-xs font-semibold text-lime-100 transition-colors hover:bg-lime-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={submitCommentsLoading}
                          aria-expanded={finishReviewOpen}
                          onClick={() => {
                            setReviewSubmitError(null);
                            setFinishReviewOpen((current) => !current);
                          }}
                        >
                          {submitCommentsLoading ? "Submitting" : "Submit review"}
                          <IconChevronDown size={14} />
                        </button>
                      </Popover.Target>
                      <Popover.Dropdown className="border-0 bg-transparent p-0 shadow-none">
                        <FinishReviewDropdown
                          body={finishReviewBody}
                          disableReviewDecisions={reviewDecisionDisabledForAuthor}
                          error={reviewSubmitError}
                          event={finishReviewEvent}
                          pendingChangeCount={pendingReviewChangeCount}
                          submitting={submitCommentsLoading}
                          onBodyChange={(body) => {
                            setFinishReviewBody(body);
                            setReviewSubmitError(null);
                          }}
                          onCancel={() => {
                            setFinishReviewOpen(false);
                            setFinishReviewBody("");
                            setFinishReviewEvent("COMMENT");
                            setReviewSubmitError(null);
                          }}
                          onEventChange={(event) => {
                            setFinishReviewEvent(event);
                            setReviewSubmitError(null);
                          }}
                          onSubmit={() => {
                            void submitDraftComments(
                              finishReviewEvent,
                              finishReviewBody,
                            );
                          }}
                        />
                      </Popover.Dropdown>
                    </Popover>
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
            {historyOpen && isPullRequestMode ? (
              <PullRequestHistory
                pullRequest={pullRequestForReview}
                comments={pullRequestComments}
                commits={pullRequestHistoryCommits}
                loading={pullRequestHistoryLoading}
                error={pullRequestHistoryError}
                pendingCommentEdits={pendingSubmittedCommentEdits}
                commentAuthor={currentGitHubUser}
                commentComposer={
                  <MarkdownComposer
                    value={conversationCommentBody}
                    onChange={setConversationCommentBody}
                    onSave={() => {
                      void submitConversationCommentDraft();
                    }}
                    onCancel={() => setConversationCommentBody("")}
                    saveLabel={
                      conversationCommentSubmitting ? "Commenting" : "Comment"
                    }
                    placeholder="Add your comment here..."
                    disabled={conversationCommentSubmitting}
                  />
                }
              />
            ) : selectedFile ? (
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
        {mergeDecision && pullRequestContext ? (
          <PullRequestMergeDecisionModal
            pullRequest={mergeDecision.pullRequest}
            mergeMethod={mergeDecision.mergeMethod ?? selectedMergeMethod}
            repoPath={repoPath}
            submitting={mergeSubmitting}
            errorMessage={mergeError}
            onCancel={() => {
              setMergeDecision(null);
              setMergeError(null);
            }}
            onSubmit={submitMergeDecision}
          />
        ) : null}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
