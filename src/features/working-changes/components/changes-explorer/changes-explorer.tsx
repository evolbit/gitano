import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { buildCompressedTree } from "@/shared/lib/tree/changes-explorer-tree";
import {
  fileMatchesSearch,
  normalizeFiles,
  partitionFiles,
} from "./utils";
import { ChangesExplorerFileRow } from "./components/changes-explorer-file-row/changes-explorer-file-row";
import { ChangesExplorerSection } from "./components/changes-explorer-section/changes-explorer-section";
import { ChangesExplorerTreeNodes } from "./components/changes-explorer-tree-nodes/changes-explorer-tree-nodes";
import { ChangesExplorerMenu } from "./components/changes-explorer-menu/changes-explorer-menu";
import { useChangesExplorerBehavior } from "./hooks/use-changes-explorer-behavior";
import { useChangesExplorerStaging } from "./hooks/use-changes-explorer-staging";
import type { ChangesExplorerProps } from "./types";
import {
  IconBinaryTree2,
  IconDotsVertical,
  IconLayoutList,
  IconSearch,
} from "@/shared/components/icons/icons";

const VIEW_MODE_OPTIONS = [
  {
    mode: "flat",
    label: "Flat View",
    Icon: IconLayoutList,
  },
  {
    mode: "tree",
    label: "Tree View",
    Icon: IconBinaryTree2,
  },
] as const;

function ChangesExplorer({
  files,
  selectedPath,
  onSelectFile,
  viewMode,
  onViewModeChange,
  showFileCheckboxes,
  surface,
  showHeader = false,
  autoFocusSearch = false,
  className = "",
  sectionMode = "tracked-untracked",
  expandedState,
  onExpandedStateChange,
  repoPath,
  onImmediateStageChange,
  isLoading = false,
  emptyStateMessage = "No files found",
  alignCountColumnWithHeaderActions = false,
  fileCommentCounts,
  onScrollTopChange,
  scrollTop = 0,
}: ChangesExplorerProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const deferredFiles = useDeferredValue(files);
  const normalizedFiles = useMemo(
    () => normalizeFiles(deferredFiles),
    [deferredFiles],
  );
  const filteredFiles = useMemo(
    () => normalizedFiles.filter((file) => fileMatchesSearch(file, search)),
    [normalizedFiles, search],
  );
  const sections = useMemo(
    () => partitionFiles(filteredFiles, sectionMode),
    [filteredFiles, sectionMode],
  );
  const sectionTrees = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        tree: buildCompressedTree(section.files),
      })),
    [sections],
  );

  const {
    expanded,
    activeContextMenu,
    menuPos,
    actionError,
    setActionError,
    containerRef,
    searchInputRef,
    menuRef,
    openContextMenu,
    closeContextMenu,
    toggleFolder,
    scheduleImmediateStageRefresh,
  } = useChangesExplorerBehavior({
    expandedState,
    onExpandedStateChange,
    autoFocusSearch,
    search,
    selectedPath,
    viewMode,
    sectionTrees,
  });

  const {
    areAllFilesFullySelected,
    getCheckboxState,
    getFolderCheckboxState,
    handleDiscardTrackedFile,
    handleDiscardTrackedFolder,
    handleTrashUntrackedFile,
    handleTrashUntrackedFolder,
    toggleAllFilesSelection,
    toggleFileSelection,
    toggleFolderSelection,
  } = useChangesExplorerStaging({
    normalizedFiles,
    onImmediateStageChange,
    repoPath,
    scheduleImmediateStageRefresh,
    setActionError,
    showFileCheckboxes,
  });

  const handleSelectFile = useCallback(
    (file: ChangesExplorerFile) => onSelectFile(file),
    [onSelectFile],
  );
  const openFileContextMenu = useCallback(
    (file: ChangesExplorerFile, x: number, y: number) => {
      openContextMenu(x, y, { kind: "file", file });
    },
    [openContextMenu],
  );
  const openFolderContextMenu = useCallback(
    (
      folderPath: string,
      filesInFolder: ChangesExplorerFile[],
      isUntracked: boolean,
      x: number,
      y: number,
    ) => {
      openContextMenu(x, y, {
        kind: "folder",
        folderPath,
        files: filesInFolder,
        isUntracked,
      });
    },
    [openContextMenu],
  );

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) return;

    scrollContainer.scrollTop = scrollTop;
  }, [filteredFiles.length, isLoading, scrollTop, viewMode]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden border-r border-border bg-background ${className}`}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, { kind: "pane" });
      }}
    >
      {showHeader ? (
        <div className="flex items-center justify-between border-b border-border bg-background-emphasis px-3 py-2">
          <span className="text-sm font-semibold text-foreground">
            {files.length} Changes
          </span>
          {showFileCheckboxes ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  openContextMenu(rect.left, rect.bottom + 4, { kind: "pane" });
                }}
                aria-label="Open changes menu"
              >
                <IconDotsVertical size={16} />
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  repoPath && normalizedFiles.length > 0
                    ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                    : "bg-zinc-800 text-zinc-400"
                }`}
                onClick={() => {
                  void toggleAllFilesSelection();
                }}
                disabled={!repoPath || normalizedFiles.length === 0}
              >
                {areAllFilesFullySelected ? "Unstage All" : "Stage All"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="border-b border-border bg-background-emphasis px-2 py-1.5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              ref={searchInputRef}
              type="text"
              className="h-8 w-full rounded border border-border bg-background px-3 pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <IconSearch className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          </div>
          {surface === "main" ? (
            <div className="flex items-center overflow-hidden rounded border border-border bg-background">
              {VIEW_MODE_OPTIONS.map((option) => {
                const active = viewMode === option.mode;
                const Icon = option.Icon;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    className={`flex h-8 w-8 items-center justify-center transition-colors ${
                      active
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    }`}
                    onClick={() => onViewModeChange(option.mode)}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <Icon size={15} />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
      >
        {actionError ? (
          <div className="border-b border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            {actionError}
          </div>
        ) : null}
        {sections.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {isLoading ? "Loading" : emptyStateMessage}
          </div>
        ) : viewMode === "flat" ? (
          sections.map((section) => (
            <ChangesExplorerSection
              key={section.name}
              name={section.name}
              sectionMode={sectionMode}
            >
              {section.files.map((file) => (
                <ChangesExplorerFileRow
                  key={file.path}
                  file={file}
                  selectedPath={selectedPath}
                  showFileCheckboxes={showFileCheckboxes}
                  checkboxState={getCheckboxState(file)}
                  onSelectFile={handleSelectFile}
                  onOpenFileContextMenu={openFileContextMenu}
                  onToggleFileSelection={toggleFileSelection}
                  alignCountColumnWithHeaderActions={
                    alignCountColumnWithHeaderActions
                  }
                  commentCount={fileCommentCounts?.[file.path] ?? 0}
                />
              ))}
            </ChangesExplorerSection>
          ))
        ) : (
          sectionTrees.map((section) => (
            <ChangesExplorerSection
              key={section.name}
              name={section.name}
              sectionMode={sectionMode}
            >
              <ChangesExplorerTreeNodes
                sectionName={section.name}
                nodes={section.tree}
                depth={0}
                search={search}
                expanded={expanded}
                selectedPath={selectedPath}
                showFileCheckboxes={showFileCheckboxes}
                getFileCheckboxState={getCheckboxState}
                onSelectFile={handleSelectFile}
                onOpenFileContextMenu={openFileContextMenu}
                onOpenFolderContextMenu={openFolderContextMenu}
                onToggleFolder={toggleFolder}
                onToggleFileSelection={toggleFileSelection}
                onToggleFolderSelection={toggleFolderSelection}
                getFolderCheckboxState={getFolderCheckboxState}
                alignCountColumnWithHeaderActions={
                  alignCountColumnWithHeaderActions
                }
                fileCommentCounts={fileCommentCounts}
              />
            </ChangesExplorerSection>
          ))
        )}
      </div>

      <ChangesExplorerMenu
        activeContextMenu={activeContextMenu}
        menuPos={menuPos}
        menuRef={menuRef}
        surface={surface}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onCloseContextMenu={closeContextMenu}
        onToggleFileSelection={toggleFileSelection}
        onToggleFolderSelection={toggleFolderSelection}
        onDiscardTrackedFile={handleDiscardTrackedFile}
        onDiscardTrackedFolder={handleDiscardTrackedFolder}
        onTrashUntrackedFile={handleTrashUntrackedFile}
        onTrashUntrackedFolder={handleTrashUntrackedFolder}
        getCheckboxState={getCheckboxState}
        getFolderCheckboxState={getFolderCheckboxState}
      />
    </div>
  );
}

export default ChangesExplorer;
