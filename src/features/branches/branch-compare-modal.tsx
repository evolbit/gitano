import { Split } from "@gfazioli/mantine-split-pane";
import ReactDOM from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlus, IconSparkles, IconX } from "@/components/icons";
import {
  DiffInteractionProvider,
  DiffViewerBase,
  type DiffInteractionContextValue,
  type DiffLineAnchor,
} from "@/features/diffs";
import type { DiffDisplayMode, DiffHunk } from "@/features/diffs/types";
import ChangesExplorer from "@/features/working-changes/changes-explorer/changes-explorer";
import type { ChangesExplorerViewMode } from "@/features/working-changes/changes-explorer/types";
import {
  getBranchComparisonFileDiff,
  getBranchComparisonFiles,
} from "@/shared/api/git/diffs";
import {
  runLocalAiAction,
  type LocalAiRunResult,
} from "@/shared/api/local-ai";
import type { FileChange } from "@/shared/types/git";
import { LocalAiResultModal, LocalAiSetupModal } from "@/features/local-ai";
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
import { getBranches } from "./api";
import { BranchCompareTargetDropdown } from "./branch-compare-target-dropdown";
import { getDefaultBranchComparisonBase } from "./branch-compare-utils";

type BranchCompareModalProps = {
  repoPath: string;
  sourceBranch: string;
  currentBranch?: string | null;
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

export function BranchCompareModal({
  repoPath,
  sourceBranch,
  currentBranch,
  onClose,
}: BranchCompareModalProps) {
  const [localBranches, setLocalBranches] = useState<string[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [baseBranch, setBaseBranch] = useState<string | null>(null);
  const [files, setFiles] = useState<FileChange[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [hunks, setHunks] = useState<DiffHunk[]>([]);
  const [hunksLoading, setHunksLoading] = useState(false);
  const [hunksError, setHunksError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] =
    useState<DiffDisplayMode>("unified");
  const [viewMode, setViewMode] = useState<ChangesExplorerViewMode>("tree");
  const [reviewThreads, setReviewThreads] = useState<ReviewThread[]>([]);
  const [activeReviewAnchor, setActiveReviewAnchor] =
    useState<DiffLineAnchor | null>(null);
  const [aiResult, setAiResult] = useState<LocalAiRunResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiSetup, setShowAiSetup] = useState(false);
  const filesRequestId = useRef(0);
  const hunksRequestId = useRef(0);

  const pairKey = useMemo(
    () =>
      baseBranch
        ? getReviewComparisonPairKey(baseBranch, sourceBranch)
        : "",
    [baseBranch, sourceBranch],
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
    let cancelled = false;
    setBranchLoading(true);
    setBranchError(null);

    Promise.all([getBranches(repoPath, "local"), getBranches(repoPath, "remote")])
      .then(([local, remote]) => {
        if (cancelled) return;
        setLocalBranches(local);
        setRemoteBranches(remote);
        setBaseBranch(
          getDefaultBranchComparisonBase({
            currentBranch,
            localBranches: local,
            remoteBranches: remote,
            sourceBranch,
          }),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setBranchError(String(error));
      })
      .finally(() => {
        if (!cancelled) setBranchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentBranch, repoPath, sourceBranch]);

  useEffect(() => {
    if (!baseBranch) {
      setFiles([]);
      setSelectedPath(null);
      return;
    }

    const requestId = filesRequestId.current + 1;
    filesRequestId.current = requestId;
    setFilesLoading(true);
    setFilesError(null);
    setFiles([]);
    setSelectedPath(null);
    setHunks([]);

    getBranchComparisonFiles({
      path: repoPath,
      baseRef: baseBranch,
      headRef: sourceBranch,
      comparisonMode: BRANCH_COMPARE_MODE,
    })
      .then((nextFiles) => {
        if (requestId !== filesRequestId.current) return;
        setFiles(nextFiles);
        setSelectedPath(nextFiles[0]?.path ?? null);
      })
      .catch((error) => {
        if (requestId === filesRequestId.current) setFilesError(String(error));
      })
      .finally(() => {
        if (requestId === filesRequestId.current) setFilesLoading(false);
      });
  }, [baseBranch, repoPath, sourceBranch]);

  useEffect(() => {
    if (!baseBranch || !selectedPath) {
      setHunks([]);
      return;
    }

    const requestId = hunksRequestId.current + 1;
    hunksRequestId.current = requestId;
    setHunksLoading(true);
    setHunksError(null);
    setHunks([]);

    getBranchComparisonFileDiff({
      path: repoPath,
      baseRef: baseBranch,
      headRef: sourceBranch,
      filePath: selectedPath,
      context: DIFF_CONTEXT_LINES,
      comparisonMode: BRANCH_COMPARE_MODE,
    })
      .then((nextHunks) => {
        if (requestId === hunksRequestId.current) setHunks(nextHunks);
      })
      .catch((error) => {
        if (requestId === hunksRequestId.current) setHunksError(String(error));
      })
      .finally(() => {
        if (requestId === hunksRequestId.current) setHunksLoading(false);
      });
  }, [baseBranch, repoPath, selectedPath, sourceBranch]);

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath],
  );

  const shouldOpenAiSetup = (analysisError: unknown) => {
    const message =
      analysisError instanceof Error
        ? analysisError.message
        : String(analysisError || "");
    return (
      message.includes("LOCAL_AI_MODEL_SETUP_REQUIRED") ||
      message.toLowerCase().includes("ollama") ||
      message.toLowerCase().includes("local ai")
    );
  };

  const runBranchAiAnalysis = useCallback(
    async (forceRefresh = false) => {
      if (!baseBranch) return;

      setAiLoading(true);
      setAiError(null);
      try {
        const result = await runLocalAiAction({
          repoPath,
          actionKind: "branchAnalysis",
          baseRef: baseBranch,
          headRef: sourceBranch,
          comparisonMode: BRANCH_COMPARE_MODE,
          forceRefresh,
        });
        setAiResult(result);
      } catch (analysisError) {
        if (shouldOpenAiSetup(analysisError)) {
          setShowAiSetup(true);
        } else {
          setAiError(
            analysisError instanceof Error
              ? analysisError.message
              : String(analysisError || "Local AI analysis failed"),
          );
        }
      } finally {
        setAiLoading(false);
      }
    },
    [baseBranch, repoPath, sourceBranch],
  );

  const beginReviewThread = useCallback((anchor: DiffLineAnchor) => {
    setActiveReviewAnchor(anchor);
  }, []);

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

        if (!isCreating && !thread) return null;

        return (
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
        );
      },
    }),
    [
      activeReviewAnchor,
      beginReviewThread,
      pairKey,
      reviewThreads,
    ],
  );

  const modalContent = (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-6 flex h-[96vh] w-[96vw] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex min-w-0 items-center justify-between border-b border-border bg-background-emphasis px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-normal text-muted-foreground">
                Compare
              </div>
              <div className="truncate text-base font-semibold text-foreground">
                {sourceBranch}
              </div>
            </div>
            <span className="text-muted-foreground">to</span>
            <BranchCompareTargetDropdown
              selectedBranch={baseBranch}
              localBranches={localBranches}
              remoteBranches={remoteBranches}
              sourceBranch={sourceBranch}
              loading={branchLoading}
              error={branchError}
              onSelectBranch={setBaseBranch}
            />
          </div>
          <div className="ml-4 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-zinc-800 px-2.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!baseBranch || aiLoading}
              onClick={() => {
                void runBranchAiAnalysis();
              }}
            >
              <IconSparkles size={14} />
              {aiLoading ? "Analyzing" : "Analyze"}
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
              emptyStateMessage={
                baseBranch ? "No changed files" : "Select a branch"
              }
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
                {filesLoading ? "Loading files..." : "No file selected"}
              </div>
            )}
          </Split.Pane>
        </Split>
        {aiError ? (
          <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {aiError}
          </div>
        ) : null}
        <LocalAiResultModal
          open={Boolean(aiResult) || aiLoading}
          title={`Analyze ${sourceBranch}`}
          result={aiResult}
          loading={aiLoading}
          error={aiError}
          onRefresh={() => {
            void runBranchAiAnalysis(true);
          }}
          onClose={() => {
            setAiResult(null);
            setAiError(null);
          }}
        />
        <LocalAiSetupModal
          open={showAiSetup}
          actionKind="branchAnalysis"
          onClose={() => setShowAiSetup(false)}
          onReady={() => {
            setShowAiSetup(false);
            void runBranchAiAnalysis();
          }}
        />
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
