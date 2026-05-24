import { Split } from "@gfazioli/mantine-split-pane";
import ReactDOM from "react-dom";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconExchange, IconPlus, IconSparkles, IconX } from "@/shared/components/icons/icons";
import {
  DiffInteractionProvider,
  DiffViewerBase,
  type DiffInteractionContextValue,
  type DiffLineAnchor,
  type DiffDisplayMode,
} from "@/features/diffs";
import {
  ChangesExplorer,
  type ChangesExplorerViewMode,
} from "@/features/working-changes";
import {
  listenToExternalAiRunEvents,
  listenToLocalAiRunProgress,
  runLocalAiAction,
  type ExternalAiRunEvent,
  type LocalAiActionKind,
  type LocalAiBranchReviewFinding,
  type LocalAiBranchReviewNote,
  type LocalAiRunProgress,
  type LocalAiRunResult,
} from "@/shared/api/local-ai";
import { writeClipboardText } from "@/shared/platform/clipboard";
import {
  appendExternalAiRunEvent,
  appendLocalAiRunProgress,
  LocalAiResultModal,
  LocalAiSetupModal,
} from "@/features/local-ai";
import { useGitActionsStore } from "@/features/repository-workspace";
import type { DiffHunk } from "@/shared/types/git";
import {
  addReviewThreadReply,
  deleteReviewThreadComment,
  findReviewThreadForAnchor,
  getReviewComparisonPairKey,
  getReviewThreadAnchorKey,
  ReviewThreadView,
  setReviewThreadStatus,
  toReviewThreadAnchor,
  updateReviewThreadComment,
  upsertReviewThreadComment,
  type ReviewCommentAuthor,
  type ReviewThread,
} from "@/features/review-comments";
import { BranchCompareBranchDropdown } from "../branch-compare-target-dropdown/branch-compare-target-dropdown";
import {
  useBranchComparisonData,
  useBranchLists,
  useBranchReviewHunks,
} from "../../hooks/use-branch-compare-data";

type BranchCompareModalProps = {
  repoPath: string;
  initialSourceBranch: string | null;
  initialTargetBranch: string | null;
  onClose: () => void;
};

const DIFF_CONTEXT_LINES = 3;
const BRANCH_COMPARE_MODE = "direct" as const;
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
const EMPTY_BRANCH_REVIEW_FINDINGS: LocalAiBranchReviewFinding[] = [];

type BranchAiAction = "analysis" | "review";

type BranchAiState = {
  result: LocalAiRunResult | null;
  loading: boolean;
  error: string | null;
  progressRunId: string | null;
  progress: LocalAiRunProgress[];
  externalEvents: ExternalAiRunEvent[];
};
type BranchAiSetupState = {
  actionKind: LocalAiActionKind;
  reason: string;
};
type BranchAiStateSetter = Dispatch<SetStateAction<BranchAiState>>;
type BranchAiRunEvent = Pick<
  LocalAiRunProgress | ExternalAiRunEvent,
  "actionKind" | "runId"
>;
type BranchAiRunListener<TEvent extends BranchAiRunEvent> = (
  handler: (event: TEvent) => void,
) => Promise<() => void> | (() => void);

const emptyBranchAiState = (): BranchAiState => ({
  result: null,
  loading: false,
  error: null,
  progressRunId: null,
  progress: [],
  externalEvents: [],
});

function createBranchAiRunId(action: BranchAiAction) {
  return `branch-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function branchAiActionKind(action: BranchAiAction): LocalAiActionKind {
  return action === "analysis" ? "branchAnalysis" : "branchReview";
}

function branchAiActionForKind(
  actionKind: LocalAiActionKind,
): BranchAiAction | null {
  if (actionKind === "branchAnalysis") return "analysis";
  if (actionKind === "branchReview") return "review";
  return null;
}

function findingAnchorKey({
  filePath,
  side,
  line,
}: {
  filePath: string;
  side: "old" | "new";
  line: number;
}) {
  return `${filePath}:${side}:${line}`;
}

function findingKey(finding: LocalAiBranchReviewFinding) {
  return `${findingAnchorKey(finding)}:${finding.title}`;
}

function buildAnchorIndex(hunksByPath: Record<string, DiffHunk[]>) {
  const index = new Map<string, DiffLineAnchor>();

  Object.entries(hunksByPath).forEach(([filePath, fileHunks]) => {
    fileHunks.forEach((hunk, hunkIdx) => {
      hunk.lines.forEach((line, lineIdx) => {
        if (line.kind === "Add" && line.new_lineno !== null) {
          index.set(
            findingAnchorKey({
              filePath,
              side: "new",
              line: line.new_lineno,
            }),
            {
              filePath,
              hunkIdx,
              lineIdx,
              side: "new",
              oldLine: line.old_lineno,
              newLine: line.new_lineno,
              kind: line.kind,
            },
          );
        }
        if (line.kind === "Del" && line.old_lineno !== null) {
          index.set(
            findingAnchorKey({
              filePath,
              side: "old",
              line: line.old_lineno,
            }),
            {
              filePath,
              hunkIdx,
              lineIdx,
              side: "old",
              oldLine: line.old_lineno,
              newLine: line.new_lineno,
              kind: line.kind,
            },
          );
        }
      });
    });
  });

  return index;
}

function formatFindingFeedback(finding: LocalAiBranchReviewFinding) {
  return [
    `**${finding.title}**`,
    "",
    `\`${finding.filePath}:${finding.line}\``,
    "",
    finding.explanation,
    finding.impact ? `\nImpact: ${finding.impact}` : "",
    finding.recommendation ? `\nRecommendation: ${finding.recommendation}` : "",
    finding.suggestedComment
      ? `\nSuggested comment:\n\n${finding.suggestedComment}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatNoteFeedback(note: LocalAiBranchReviewNote) {
  return [
    `**${note.title}**`,
    note.filePath ? `\n\`${note.filePath}\`` : "",
    "",
    note.explanation,
    note.recommendation ? `\nRecommendation: ${note.recommendation}` : "",
    note.suggestedComment ? `\nSuggested comment:\n\n${note.suggestedComment}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function reviewResultData(result: LocalAiRunResult | null) {
  return result?.result.kind === "branchReview" ? result.result.data : null;
}

function describeAiError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

function shouldOpenAiSetup(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  return (
    errorMessage.includes("LOCAL_AI_MODEL_SETUP_REQUIRED") ||
    normalized.includes("no ai model selected") ||
    normalized.includes("no ai models available") ||
    normalized.includes("ollama runtime is unavailable") ||
    normalized.includes("ollama did not respond") ||
    normalized.includes("local ai runtime is unavailable") ||
    normalized.includes("local ai runtime could not be started")
  );
}

function branchAiFailureTitle(action: BranchAiAction, errorMessage: string) {
  const actionLabel = action === "review" ? "review" : "analysis";
  return `Local AI ${actionLabel} failed: ${errorMessage}`;
}

function branchAiSetter(
  action: BranchAiAction,
  setBranchAnalysis: BranchAiStateSetter,
  setBranchReview: BranchAiStateSetter,
) {
  return action === "analysis" ? setBranchAnalysis : setBranchReview;
}

function useBranchAiRunEvents<TEvent extends BranchAiRunEvent>({
  activeRunIdsRef,
  listen,
  updateState,
  appendEvent,
}: {
  activeRunIdsRef: MutableRefObject<Record<BranchAiAction, string | null>>;
  listen: BranchAiRunListener<TEvent>;
  updateState: (
    action: BranchAiAction,
    updater: SetStateAction<BranchAiState>,
  ) => void;
  appendEvent: (current: BranchAiState, event: TEvent) => BranchAiState;
}) {
  useEffect(() => {
    const unlistenPromise = listen((event) => {
      const action = branchAiActionForKind(event.actionKind);
      if (!action || event.runId !== activeRunIdsRef.current[action]) {
        return;
      }

      updateState(action, (current) => appendEvent(current, event));
    });

    return () => {
      void Promise.resolve(unlistenPromise)
        .then((unlisten) => unlisten())
        .catch(() => undefined);
    };
  }, [activeRunIdsRef, appendEvent, listen, updateState]);
}

function visibleBranchReviewResult(
  result: LocalAiRunResult | null,
  anchorIndex: Map<string, DiffLineAnchor>,
  dismissedFindingKeys: Set<string>,
  reviewHunksLoading: boolean,
): LocalAiRunResult | null {
  if (!result || result.result.kind !== "branchReview") {
    return result;
  }

  const data = result.result.data;
  const notes = [...data.notes];
  const findings = data.findings.filter((finding) => {
    if (dismissedFindingKeys.has(findingKey(finding))) {
      return false;
    }

    const anchor = anchorIndex.get(findingAnchorKey(finding));
    if (!anchor && !reviewHunksLoading) {
      notes.push({
        severity: finding.severity,
        confidence: finding.confidence,
        title: finding.title,
        explanation: finding.explanation,
        recommendation: finding.recommendation,
        suggestedComment: finding.suggestedComment,
        filePath: finding.filePath,
      });
      return false;
    }

    return true;
  });

  return {
    ...result,
    result: {
      kind: "branchReview",
      data: {
        ...data,
        findings,
        notes,
      },
    },
  };
}

export function BranchCompareModal({
  repoPath,
  initialSourceBranch,
  initialTargetBranch,
  onClose,
}: BranchCompareModalProps) {
  const setGitActionNotice = useGitActionsStore((state) => state.setNotice);
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
  const [reviewThreads, setReviewThreads] = useState<ReviewThread[]>([]);
  const [activeReviewAnchor, setActiveReviewAnchor] =
    useState<DiffLineAnchor | null>(null);
  const [branchAnalysis, setBranchAnalysis] = useState<BranchAiState>(
    emptyBranchAiState,
  );
  const [branchReview, setBranchReview] = useState<BranchAiState>(
    emptyBranchAiState,
  );
  const [dismissedAiFindingKeys, setDismissedAiFindingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [branchAiSetup, setBranchAiSetup] =
    useState<BranchAiSetupState | null>(null);
  const activeBranchAiRunIdsRef = useRef<
    Record<BranchAiAction, string | null>
  >({
    analysis: null,
    review: null,
  });
  const updateBranchAiState = useCallback(
    (action: BranchAiAction, updater: SetStateAction<BranchAiState>) => {
      branchAiSetter(action, setBranchAnalysis, setBranchReview)(updater);
    },
    [],
  );

  useEffect(() => {
    setSourceBranch(initialSourceBranch);
    setTargetBranch(initialTargetBranch);
  }, [initialSourceBranch, initialTargetBranch]);

  const comparisonReady = Boolean(
    sourceBranch && targetBranch && sourceBranch !== targetBranch,
  );
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
    comparisonMode: BRANCH_COMPARE_MODE,
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
    comparisonMode: BRANCH_COMPARE_MODE,
    contextLines: DIFF_CONTEXT_LINES,
  });
  const branchReviewAnchorIndex = useMemo(
    () => buildAnchorIndex(reviewHunksByPath),
    [reviewHunksByPath],
  );

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

  useBranchAiRunEvents({
    activeRunIdsRef: activeBranchAiRunIdsRef,
    listen: listenToLocalAiRunProgress,
    updateState: updateBranchAiState,
    appendEvent: appendLocalAiRunProgress,
  });

  useBranchAiRunEvents({
    activeRunIdsRef: activeBranchAiRunIdsRef,
    listen: listenToExternalAiRunEvents,
    updateState: updateBranchAiState,
    appendEvent: appendExternalAiRunEvent,
  });

  useEffect(() => {
    activeBranchAiRunIdsRef.current = {
      analysis: null,
      review: null,
    };
    setBranchAnalysis(emptyBranchAiState());
    setBranchReview(emptyBranchAiState());
    setReviewHunksByPath({});
    setDismissedAiFindingKeys(new Set());
    setActiveReviewAnchor(null);
  }, [pairKey, setReviewHunksByPath]);

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

  const runBranchAiAction = useCallback(
    async (action: BranchAiAction, forceRefresh = false) => {
      if (!comparisonReady || !sourceBranch || !targetBranch) return;

      const actionKind = branchAiActionKind(action);
      const runId = createBranchAiRunId(action);
      activeBranchAiRunIdsRef.current[action] = runId;
      const setState = branchAiSetter(action, setBranchAnalysis, setBranchReview);
      setState({
        result: null,
        loading: true,
        error: null,
        progressRunId: runId,
        progress: [],
        externalEvents: [],
      });
      if (action === "review") {
        setDismissedAiFindingKeys(new Set());
        setReviewHunksByPath({});
      }

      try {
        const result = await runLocalAiAction({
          repoPath,
          actionKind,
          runId,
          baseRef: targetBranch,
          headRef: sourceBranch,
          comparisonMode: BRANCH_COMPARE_MODE,
          forceRefresh,
        });
        if (activeBranchAiRunIdsRef.current[action] !== runId) return;
        setState((current) =>
          current.progressRunId === runId
            ? {
                ...current,
                result,
                loading: false,
                error: null,
                progressRunId: runId,
              }
            : current,
        );
      } catch (analysisError) {
        if (activeBranchAiRunIdsRef.current[action] !== runId) return;
        const errorMessage = describeAiError(analysisError);
        console.error("Branch local AI action failed", {
          actionKind,
          error: analysisError,
        });
        const opensSetup = shouldOpenAiSetup(errorMessage);
        notifyAiError(
          opensSetup
            ? "Local AI setup required"
            : branchAiFailureTitle(action, errorMessage),
          analysisError,
          true,
        );
        if (opensSetup) {
          setBranchAiSetup({
            actionKind,
            reason: errorMessage,
          });
        }
        setState((current) =>
          current.progressRunId === runId
            ? {
                ...current,
                result: null,
                loading: false,
                error: null,
                progressRunId: runId,
              }
            : current,
        );
      }
    },
    [
      comparisonReady,
      notifyAiError,
      repoPath,
      setReviewHunksByPath,
      sourceBranch,
      targetBranch,
    ],
  );

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
      setDismissedAiFindingKeys((current) => {
        const next = new Set(current);
        next.add(findingKey(finding));
        return next;
      });
    },
    [branchReviewAnchorIndex, pairKey],
  );

  const dismissAiFinding = useCallback((finding: LocalAiBranchReviewFinding) => {
    setDismissedAiFindingKeys((current) => {
      const next = new Set(current);
      next.add(findingKey(finding));
      return next;
    });
  }, []);

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
              void copyAiFeedback(formatFindingFeedback(finding));
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
      copyAiFeedback,
      dismissAiFinding,
    ],
  );

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
        const thread = findReviewThreadForAnchor(
          reviewThreads,
          pairKey,
          threadAnchor,
        ) ?? null;
        const isCreating =
          !!activeReviewAnchor &&
          !thread &&
          getReviewThreadAnchorKey(pairKey, toReviewThreadAnchor(activeReviewAnchor)) ===
            getReviewThreadAnchorKey(pairKey, threadAnchor);

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

  const branchAiLoading = branchAnalysis.loading || branchReview.loading;
  const comparisonTitle = sourceBranch ?? "branch";

  const modalContent = (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-6 flex h-[96vh] w-[96vw] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex min-w-0 items-center justify-between border-b border-border bg-background-emphasis px-5 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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
            <span className="text-sm font-semibold text-foreground">against</span>
            <BranchCompareBranchDropdown
              selectedBranch={targetBranch}
              localBranches={localBranches}
              remoteBranches={remoteBranches}
              placeholder="Select target branch"
              loading={branchLoading}
              error={branchError}
              onSelectBranch={setTargetBranch}
            />
          </div>
          <div className="ml-4 flex items-center gap-2">
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
        </Split>
        <LocalAiResultModal
          open={Boolean(branchAnalysis.result) || branchAnalysis.loading}
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
            activeBranchAiRunIdsRef.current.analysis = null;
            setBranchAnalysis(emptyBranchAiState());
          }}
        />
        <LocalAiResultModal
          open={Boolean(visibleReviewResult) || branchReview.loading}
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
            activeBranchAiRunIdsRef.current.review = null;
            setBranchReview(emptyBranchAiState());
            setReviewHunksByPath({});
            setDismissedAiFindingKeys(new Set());
          }}
        />
        <LocalAiSetupModal
          open={Boolean(branchAiSetup)}
          actionKind={branchAiSetup?.actionKind ?? null}
          setupReason={branchAiSetup?.reason ?? null}
          onClose={() => setBranchAiSetup(null)}
          onReady={() => {
            const action =
              branchAiSetup?.actionKind === "branchReview" ? "review" : "analysis";
            setBranchAiSetup(null);
            void runBranchAiAction(action);
          }}
        />
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
