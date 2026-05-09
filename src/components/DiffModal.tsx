import { Split } from "@gfazioli/mantine-split-pane";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useRepoStore } from "../store/repo";
import DiffFileList from "./DiffFileList";
import DiffViewer from "./DiffViewer";
import { IconX } from "./icons";

interface FileChange {
  path: string;
  status: string;
  insertions: number;
  deletions: number;
}

interface DiffModalProps {
  open: boolean;
  files: FileChange[];
  initialFile: FileChange;
  onClose: () => void;
  repoPath?: string;
  sha?: string;
}

const DiffModal = ({
  open,
  files,
  initialFile,
  onClose,
  repoPath,
  sha,
}: DiffModalProps) => {
  const [search, setSearch] = useState("");

  // Compute the initial index based on initialFile
  const getInitialIndex = () => {
    if (!initialFile || !files.length) return 0;
    const idx = files.findIndex(
      (f) => f.path.toLowerCase() === initialFile.path.toLowerCase()
    );
    return idx !== -1 ? idx : 0;
  };

  const [selectedIndex, setSelectedIndex] = useState(getInitialIndex);
  const listRef = useRef<HTMLUListElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // If repoPath is not provided as a prop, read it from the store (active tab)
  const storeRepoPath = useRepoStore(
    useShallow((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      return tab?.repoPath;
    })
  );
  const effectiveRepoPath = repoPath || storeRepoPath;

  // File filtering
  const filteredFiles = useMemo(
    () =>
      files.filter((f) => f.path.toLowerCase().includes(search.toLowerCase())),
    [files, search]
  );

  // Clear the search when opening the modal
  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus the list when opening the modal
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.focus();
    }
  }, [open]);

  // Auto-scroll to keep the selected row visible
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-file-index='${selectedIndex}']`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Normalize files for DiffFileList
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
          ? (file.status as import("../types/git").FileChange["status"])
          : "modified",
      })),
    [files]
  );

  const selected = filteredFiles[selectedIndex];

  const modalContent = (
    <div className="fixed inset-0 z-[10000]">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />
      {/* Main modal */}
      <div
        ref={modalRef}
        className="relative w-[96vw] h-[96vh] mx-auto my-6 bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden min-h-0"
        style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-emphasis">
          <div className="flex items-center gap-2 w-1/2">
            <span className="font-bold text-lg">Diferencias de archivos</span>
            <div className="flex-1" />
          </div>
          <button
            className="ml-4 p-2 rounded hover:bg-zinc-800 text-2xl text-muted-foreground"
            onClick={onClose}
            aria-label="Cerrar">
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
            <DiffFileList
              ref={listRef}
              files={normalizedFiles}
              selectedIndex={selectedIndex}
              onSelect={(_, idx) => setSelectedIndex(idx)}
              onAction={(_, idx) => setSelectedIndex(idx)}
              autoFocusSearch={true}
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
                <div className="text-red-400">
                  No se encontró el repoPath o archivo
                </div>
              )}
            </div>
          </Split.Pane>
        </Split>
      </div>
    </div>
  );

  console.log("[DiffModal] selectedIndex:", selectedIndex);

  return ReactDOM.createPortal(modalContent, document.body);
};

export default DiffModal;
