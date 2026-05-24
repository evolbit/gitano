import { Split } from "@gfazioli/mantine-split-pane";
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
import { writeClipboardText } from "@/shared/platform/clipboard";
import {
  LocalAiResultModal,
  LocalAiSetupModal,
} from "@/features/local-ai";
import { useGitActionsStore } from "@/features/repository-workspace";
import { getReviewComparisonPairKey } from "@/features/review-comments";
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
  onClose: () => void;
};

const DIFF_CONTEXT_LINES = 3;
const BRANCH_COMPARE_MODE = "direct" as const;
const EMPTY_BRANCH_REVIEW_FINDINGS: LocalAiBranchReviewFinding[] = [];

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
    comparisonMode: BRANCH_COMPARE_MODE,
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

  const { interactionValue, renderAiFindingActions } = useBranchReviewThreads({
    branchReviewAnchorIndex,
    branchReviewData,
    dismissAiFinding,
    dismissedAiFindingKeys,
    onCopyAiFeedback: copyAiFeedback,
    pairKey,
  });

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
            resetBranchAiAction("analysis");
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
