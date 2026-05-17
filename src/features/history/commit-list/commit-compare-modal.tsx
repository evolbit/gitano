import { Split } from "@gfazioli/mantine-split-pane";
import ReactDOM from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconX } from "@/components/icons";
import { DiffViewerBase } from "@/features/diffs";
import type { DiffDisplayMode, DiffHunk } from "@/features/diffs/types";
import ChangesExplorer from "@/features/working-changes/changes-explorer/changes-explorer";
import type { ChangesExplorerViewMode } from "@/features/working-changes/changes-explorer/types";
import { getCommitDiff } from "@/shared/api/git/commits";
import {
  getCommitFileDiff,
  getCommitWorktreeComparisonFileDiff,
  getCommitWorktreeComparisonFiles,
} from "@/shared/api/git/diffs";
import type { CommitListItem, FileChange } from "@/shared/types/git";

export type CommitCompareMode = "parent" | "workingTree";

type CommitCompareModalProps = {
  repoPath: string;
  commit: CommitListItem;
  mode: CommitCompareMode;
  onClose: () => void;
};

const DIFF_CONTEXT_LINES = 3;

function getModeLabels(commit: CommitListItem, mode: CommitCompareMode) {
  const shortSha = commit.sha.slice(0, 7);
  const parentSha = commit.parents?.[0]?.slice(0, 7) ?? "empty tree";

  if (mode === "parent") {
    return {
      title: "Compare with parent",
      from: parentSha,
      to: shortSha,
      emptyState: "No changes from parent",
    };
  }

  return {
    title: "Compare with working tree",
    from: shortSha,
    to: "working tree",
    emptyState: "No differences with working tree",
  };
}

export function CommitCompareModal({
  repoPath,
  commit,
  mode,
  onClose,
}: CommitCompareModalProps) {
  const [files, setFiles] = useState<FileChange[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [hunks, setHunks] = useState<DiffHunk[]>([]);
  const [hunksLoading, setHunksLoading] = useState(false);
  const [hunksError, setHunksError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ChangesExplorerViewMode>("tree");
  const [displayMode, setDisplayMode] = useState<DiffDisplayMode>("unified");
  const filesRequestId = useRef(0);
  const hunksRequestId = useRef(0);
  const labels = useMemo(() => getModeLabels(commit, mode), [commit, mode]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    const requestId = filesRequestId.current + 1;
    filesRequestId.current = requestId;
    setFilesLoading(true);
    setFilesError(null);
    setFiles([]);
    setSelectedPath(null);
    setHunks([]);

    const filesRequest =
      mode === "parent"
        ? getCommitDiff(repoPath, commit.sha).then((diff) => diff.changes)
        : getCommitWorktreeComparisonFiles({
            path: repoPath,
            baseRef: commit.sha,
          });

    filesRequest
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
  }, [commit.sha, mode, repoPath]);

  useEffect(() => {
    if (!selectedPath) {
      setHunks([]);
      return;
    }

    const requestId = hunksRequestId.current + 1;
    hunksRequestId.current = requestId;
    setHunksLoading(true);
    setHunksError(null);
    setHunks([]);

    const hunksRequest =
      mode === "parent"
        ? getCommitFileDiff({
            path: repoPath,
            sha: commit.sha,
            filePath: selectedPath,
            context: DIFF_CONTEXT_LINES,
          })
        : getCommitWorktreeComparisonFileDiff({
            path: repoPath,
            baseRef: commit.sha,
            filePath: selectedPath,
            context: DIFF_CONTEXT_LINES,
          });

    hunksRequest
      .then((nextHunks) => {
        if (requestId === hunksRequestId.current) setHunks(nextHunks);
      })
      .catch((error) => {
        if (requestId === hunksRequestId.current) setHunksError(String(error));
      })
      .finally(() => {
        if (requestId === hunksRequestId.current) setHunksLoading(false);
      });
  }, [commit.sha, mode, repoPath, selectedPath]);

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath],
  );

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-6 flex h-[96vh] w-[96vw] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex min-w-0 items-center justify-between border-b border-border bg-background-emphasis px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-normal text-muted-foreground">
                {labels.title}
              </div>
              <div className="truncate text-base font-semibold text-foreground">
                {commit.sha.slice(0, 7)} · {commit.message || "Untitled commit"}
              </div>
            </div>
            <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
              <span className="max-w-32 truncate rounded border border-border bg-background px-2 py-1 font-mono text-xs text-zinc-300">
                {labels.from}
              </span>
              <span>to</span>
              <span className="max-w-36 truncate rounded border border-border bg-background px-2 py-1 font-mono text-xs text-zinc-300">
                {labels.to}
              </span>
            </div>
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
              emptyStateMessage={labels.emptyState}
            />
          </Split.Pane>
          <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
          <Split.Pane grow className="min-h-0 bg-background">
            {selectedFile ? (
              <DiffViewerBase
                filePath={selectedFile.path}
                hunks={hunks}
                loading={hunksLoading}
                error={hunksError}
                displayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {filesLoading ? "Loading files..." : "No file selected"}
              </div>
            )}
          </Split.Pane>
        </Split>
      </div>
    </div>,
    document.body,
  );
}
