import { Split } from "@gfazioli/mantine-split-pane";
import ReactDOM from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlus, IconX, IconPencil } from "@/components/icons";
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
import type { FileChange } from "@/shared/types/git";
import { getBranches } from "./api";
import {
  commentsForAnchor,
  createDraftComment,
  deleteDraftComment,
  getBranchComparisonPairKey,
  getDraftCommentAnchorKey,
  updateDraftComment,
  type DraftDiffComment,
} from "./branch-compare-comments";
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
  const [comments, setComments] = useState<DraftDiffComment[]>([]);
  const [activeDraftAnchor, setActiveDraftAnchor] =
    useState<DiffLineAnchor | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const filesRequestId = useRef(0);
  const hunksRequestId = useRef(0);

  const pairKey = useMemo(
    () =>
      baseBranch
        ? getBranchComparisonPairKey(baseBranch, sourceBranch)
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

  const beginDraftComment = useCallback((anchor: DiffLineAnchor) => {
    setActiveDraftAnchor(anchor);
    setDraftBody("");
  }, []);

  const saveDraftComment = useCallback(() => {
    if (!activeDraftAnchor || !pairKey) return;
    const body = draftBody.trim();
    if (!body) return;

    setComments((current) => [
      ...current,
      createDraftComment(pairKey, activeDraftAnchor, body),
    ]);
    setActiveDraftAnchor(null);
    setDraftBody("");
  }, [activeDraftAnchor, draftBody, pairKey]);

  const interactionValue = useMemo<DiffInteractionContextValue>(
    () => ({
      renderLineAccessory: (anchor) => {
        const anchorComments = pairKey
          ? commentsForAnchor(comments, pairKey, anchor)
          : [];
        return (
          <button
            type="button"
            className={`flex h-6 min-w-6 items-center justify-center rounded border text-[11px] transition-colors ${
              anchorComments.length > 0
                ? "border-blue-500/50 bg-blue-500/20 text-blue-100"
                : "border-border bg-background text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-zinc-100"
            }`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              beginDraftComment(anchor);
            }}
            aria-label="Add comment"
          >
            {anchorComments.length > 0 ? anchorComments.length : <IconPlus size={13} />}
          </button>
        );
      },
      renderLineBelow: (anchor) => {
        if (!pairKey) return null;
        const anchorKey = getDraftCommentAnchorKey(pairKey, anchor);
        const isComposing =
          activeDraftAnchor &&
          getDraftCommentAnchorKey(pairKey, activeDraftAnchor) === anchorKey;
        const anchorComments = commentsForAnchor(comments, pairKey, anchor);

        if (!isComposing && anchorComments.length === 0) return null;

        return (
          <DraftCommentThread
            comments={anchorComments}
            draftBody={isComposing ? draftBody : null}
            onDraftBodyChange={setDraftBody}
            onSaveDraft={saveDraftComment}
            onCancelDraft={() => {
              setActiveDraftAnchor(null);
              setDraftBody("");
            }}
            onUpdateComment={(commentId, body) =>
              setComments((current) => updateDraftComment(current, commentId, body))
            }
            onDeleteComment={(commentId) =>
              setComments((current) => deleteDraftComment(current, commentId))
            }
          />
        );
      },
    }),
    [
      activeDraftAnchor,
      beginDraftComment,
      comments,
      draftBody,
      pairKey,
      saveDraftComment,
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
          <button
            type="button"
            className="ml-4 rounded p-2 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={22} />
          </button>
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
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

function DraftCommentThread({
  comments,
  draftBody,
  onDraftBodyChange,
  onSaveDraft,
  onCancelDraft,
  onUpdateComment,
  onDeleteComment,
}: {
  comments: DraftDiffComment[];
  draftBody: string | null;
  onDraftBodyChange: (value: string) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onUpdateComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
}) {
  return (
    <div className="space-y-2 text-sm">
      {comments.map((comment) => (
        <DraftCommentItem
          key={comment.id}
          comment={comment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
        />
      ))}
      {draftBody !== null ? (
        <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2">
          <textarea
            value={draftBody}
            onChange={(event) => onDraftBodyChange(event.target.value)}
            className="min-h-20 w-full resize-none rounded border border-border bg-background p-2 text-sm text-foreground focus:outline-none"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              onClick={onCancelDraft}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onSaveDraft}
              disabled={!draftBody.trim()}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DraftCommentItem({
  comment,
  onUpdateComment,
  onDeleteComment,
}: {
  comment: DraftDiffComment;
  onUpdateComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);

  useEffect(() => {
    if (!editing) setBody(comment.body);
  }, [comment.body, editing]);

  if (editing) {
    return (
      <div className="rounded border border-border bg-background p-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-20 w-full resize-none rounded border border-border bg-background-emphasis p-2 text-sm text-foreground focus:outline-none"
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              const nextBody = body.trim();
              if (!nextBody) return;
              onUpdateComment(comment.id, nextBody);
              setEditing(false);
            }}
            disabled={!body.trim()}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-background p-2">
      <div className="whitespace-pre-wrap text-zinc-200">{comment.body}</div>
      <div className="mt-2 flex justify-end gap-1">
        <button
          type="button"
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          onClick={() => setEditing(true)}
          aria-label="Edit comment"
        >
          <IconPencil size={14} />
        </button>
        <button
          type="button"
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-200"
          onClick={() => onDeleteComment(comment.id)}
          aria-label="Delete comment"
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}
