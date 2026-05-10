import { Split } from "@gfazioli/mantine-split-pane";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useRepoStore } from "../store/repo";
import { useFileHunksStore } from "../store/hunks";
import { FileChange, FileChangeWithHunks } from "../types/git";
import ChangesExplorer, { ChangesExplorerViewMode } from "./ChangesExplorer";
import DiffViewer from "./DiffViewer";
import { IconX } from "./icons";

type DiffModalFile = FileChange | FileChangeWithHunks;
type DiffModalSectionMode = "tracked-untracked" | "single";

function isFileChangeWithHunks(file: DiffModalFile): file is FileChangeWithHunks {
  return "hunks" in file;
}

interface DiffModalProps {
  open: boolean;
  files: DiffModalFile[];
  initialFile: DiffModalFile;
  onClose: () => void;
  onFileSelect?: (file: DiffModalFile) => void;
  repoPath?: string;
  sha?: string;
  changesViewMode?: ChangesExplorerViewMode;
  onChangesViewModeChange?: (mode: ChangesExplorerViewMode) => void;
  sectionMode?: DiffModalSectionMode;
}

const DiffModal = ({
  open,
  files,
  initialFile,
  onClose,
  onFileSelect,
  repoPath,
  sha,
  changesViewMode = "tree",
  onChangesViewModeChange,
  sectionMode = "tracked-untracked",
}: DiffModalProps) => {
  const [selectedPath, setSelectedPath] = useState(initialFile.path);
  const [internalChangesViewMode, setInternalChangesViewMode] =
    useState<ChangesExplorerViewMode>(changesViewMode);
  const modalRef = useRef<HTMLDivElement>(null);
  const setFileHunks = useFileHunksStore((s) => s.setFileHunks);

  // If repoPath is not provided as a prop, read it from the store (active tab)
  const storeRepoPath = useRepoStore(
    useShallow((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      return tab?.repoPath;
    })
  );
  const effectiveRepoPath = repoPath || storeRepoPath;

  // Clear the search when opening the modal
  useEffect(() => {
    if (open) {
      setSelectedPath(initialFile.path);
    }
  }, [open, initialFile.path]);

  useEffect(() => {
    if (onChangesViewModeChange) return;
    setInternalChangesViewMode(changesViewMode);
  }, [changesViewMode, onChangesViewModeChange]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const allowedStatuses = [
    "added",
    "deleted",
    "modified",
    "renamed",
    "copied",
    "typeChanged",
  ];
  const normalizedFiles = useMemo(
    () =>
      files.map((file) => ({
        ...file,
        status: allowedStatuses.includes(file.status)
          ? (file.status as FileChange["status"])
          : "modified",
      })),
    [files]
  );

  const selected =
    normalizedFiles.find(
      (file) => file.path.toLowerCase() === selectedPath.toLowerCase()
    ) ??
    normalizedFiles.find(
      (file) => file.path.toLowerCase() === initialFile.path.toLowerCase()
    ) ??
    normalizedFiles[0];

  const effectiveChangesViewMode = onChangesViewModeChange
    ? changesViewMode
    : internalChangesViewMode;

  useEffect(() => {
    if (sha || !selected) return;
    if (!isFileChangeWithHunks(selected)) return;
    setFileHunks(selected.path, selected.hunks);
  }, [selected, setFileHunks, sha]);

  const handleSelectFile = (file: DiffModalFile) => {
    setSelectedPath(file.path);
    onFileSelect?.(file);
  };

  const handleChangeViewMode = (mode: ChangesExplorerViewMode) => {
    if (onChangesViewModeChange) {
      onChangesViewModeChange(mode);
      return;
    }

    setInternalChangesViewMode(mode);
  };

  if (!open) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[10000]">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />
      {/* Main modal */}
      <div
        ref={modalRef}
        className="relative w-[96vw] h-[96vh] mx-auto my-6 bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden min-h-0"
        style={{ zIndex: 1 }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-emphasis">
          <div className="flex items-center gap-2 w-1/2">
            <span className="font-bold text-lg">File differences</span>
            <div className="flex-1" />
          </div>
          <button
            className="ml-4 p-2 rounded hover:bg-zinc-800 text-2xl text-muted-foreground"
            onClick={onClose}
            aria-label="Close">
            <IconX size={22} />
          </button>
        </div>
        {/* Resizable split */}
        <Split className="flex-1 min-h-0 w-full flex h-full">
          {/* Left panel: file list */}
          <Split.Pane
            initialWidth={340}
            minWidth={220}
            maxWidth={500}>
            <ChangesExplorer
              files={normalizedFiles}
              selectedPath={selected?.path ?? initialFile.path}
              onSelectFile={handleSelectFile}
              viewMode={effectiveChangesViewMode}
              onViewModeChange={handleChangeViewMode}
              showFileCheckboxes={sha === undefined}
              surface={sha === undefined ? "modal" : "main"}
              showHeader={sha === undefined}
              autoFocusSearch={true}
              sectionMode={sectionMode}
            />
          </Split.Pane>
          <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
          {/* Right panel: diff */}
          <Split.Pane
            grow
            className="h-full min-h-0 bg-background flex flex-col">
            <div className="flex-1 overflow-auto p-6">
              {/* Actual diff for the selected file */}
              {effectiveRepoPath && selected ? (
                <DiffViewer
                  repoPath={effectiveRepoPath}
                  filePath={selected.path}
                  sha={sha}
                />
              ) : (
                <div className="text-red-400">Repository path or file not found</div>
              )}
            </div>
          </Split.Pane>
        </Split>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default DiffModal;
