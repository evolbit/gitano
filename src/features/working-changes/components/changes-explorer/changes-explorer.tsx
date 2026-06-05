import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  ChangesExplorerFile,
  ChangesExplorerTreeNode,
} from "@/shared/lib/tree/changes-explorer-tree";
import { buildCompressedTree } from "@/shared/lib/tree/changes-explorer-tree";
import {
  fileMatchesSearch,
  normalizeFiles,
  partitionFiles,
} from "./utils";
import { ChangesExplorerFileRow } from "./components/changes-explorer-file-row/changes-explorer-file-row";
import { ChangesExplorerMenu } from "./components/changes-explorer-menu/changes-explorer-menu";
import { TreeNodeRow } from "./components/tree-node-row/tree-node-row";
import { useChangesExplorerBehavior } from "./hooks/use-changes-explorer-behavior";
import { useChangesExplorerStaging } from "./hooks/use-changes-explorer-staging";
import { getFolderExpansionKey } from "./utils/folder-expansion-key";
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

const EXPLORER_ROW_HEIGHT = 28;
const EXPLORER_ROW_OVERSCAN = 12;

type ExplorerRow =
  | {
      kind: "section";
      name: string;
    }
  | {
      kind: "flat-file";
      file: ChangesExplorerFile;
    }
  | {
      kind: "tree-node";
      sectionName: string;
      node: ChangesExplorerTreeNode;
      depth: number;
    };

function flattenTreeRows({
  expanded,
  nodes,
  rows,
  search,
  sectionName,
  depth,
}: {
  expanded: Record<string, boolean>;
  nodes: ChangesExplorerTreeNode[];
  rows: ExplorerRow[];
  search: string;
  sectionName: string;
  depth: number;
}) {
  nodes.forEach((node) => {
    rows.push({ kind: "tree-node", sectionName, node, depth });

    if (node.kind !== "folder") return;

    const expansionKey = getFolderExpansionKey(sectionName, node.path);
    const isOpen = search ? true : (expanded[expansionKey] ?? true);
    if (!isOpen) return;

    flattenTreeRows({
      expanded,
      nodes: node.children,
      rows,
      search,
      sectionName,
      depth: depth + 1,
    });
  });
}

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
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
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
    hasStageableFiles,
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
  const rows = useMemo<ExplorerRow[]>(() => {
    const nextRows: ExplorerRow[] = [];

    if (viewMode === "flat") {
      sections.forEach((section) => {
        if (sectionMode === "tracked-untracked") {
          nextRows.push({ kind: "section", name: section.name });
        }
        section.files.forEach((file) => {
          nextRows.push({ kind: "flat-file", file });
        });
      });
      return nextRows;
    }

    sectionTrees.forEach((section) => {
      if (sectionMode === "tracked-untracked") {
        nextRows.push({ kind: "section", name: section.name });
      }
      flattenTreeRows({
        expanded,
        nodes: section.tree,
        rows: nextRows,
        search,
        sectionName: section.name,
        depth: 0,
      });
    });

    return nextRows;
  }, [expanded, search, sectionMode, sectionTrees, sections, viewMode]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainer,
    estimateSize: () => EXPLORER_ROW_HEIGHT,
    initialRect: { width: 0, height: EXPLORER_ROW_HEIGHT * 20 },
    overscan: EXPLORER_ROW_OVERSCAN,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const renderedVirtualRows =
    virtualRows.length > 0 || rows.length > EXPLORER_ROW_OVERSCAN * 2
      ? virtualRows
      : rows.map((_, index) => ({
          key: index,
          index,
          size: EXPLORER_ROW_HEIGHT,
          start: index * EXPLORER_ROW_HEIGHT,
        }));
  const setScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    setScrollContainer(node);
  }, []);

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
  const renderRow = useCallback(
    (row: ExplorerRow) => {
      if (row.kind === "section") {
        return (
          <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-zinc-500/90">
            {row.name}
          </div>
        );
      }

      if (row.kind === "flat-file") {
        return (
          <ChangesExplorerFileRow
            file={row.file}
            selectedPath={selectedPath}
            showFileCheckboxes={showFileCheckboxes}
            checkboxState={getCheckboxState(row.file)}
            onSelectFile={handleSelectFile}
            onOpenFileContextMenu={openFileContextMenu}
            onToggleFileSelection={toggleFileSelection}
            alignCountColumnWithHeaderActions={alignCountColumnWithHeaderActions}
            commentCount={fileCommentCounts?.[row.file.path] ?? 0}
          />
        );
      }

      return (
        <TreeNodeRow
          sectionName={row.sectionName}
          node={row.node}
          depth={row.depth}
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
          alignCountColumnWithHeaderActions={alignCountColumnWithHeaderActions}
          fileCommentCounts={fileCommentCounts}
          renderChildren={false}
        />
      );
    },
    [
      alignCountColumnWithHeaderActions,
      expanded,
      fileCommentCounts,
      getCheckboxState,
      getFolderCheckboxState,
      handleSelectFile,
      openFileContextMenu,
      openFolderContextMenu,
      search,
      selectedPath,
      showFileCheckboxes,
      toggleFileSelection,
      toggleFolder,
      toggleFolderSelection,
    ],
  );

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) return;

    scrollContainer.scrollTop = scrollTop;
  }, [filteredFiles.length, isLoading, scrollTop, viewMode]);

  useEffect(() => {
    if (!selectedPath) return;

    const selectedRowIndex = rows.findIndex((row) => {
      if (row.kind === "flat-file") return row.file.path === selectedPath;
      if (row.kind === "tree-node" && row.node.kind === "file") {
        return row.node.file.path === selectedPath;
      }
      return false;
    });

    if (selectedRowIndex === -1) return;

    rowVirtualizer.scrollToIndex(selectedRowIndex, { align: "auto" });
  }, [rowVirtualizer, rows, selectedPath]);

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
                  repoPath && hasStageableFiles
                    ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                    : "bg-zinc-800 text-zinc-400"
                }`}
                onClick={() => {
                  void toggleAllFilesSelection();
                }}
                disabled={!repoPath || !hasStageableFiles}
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
        ref={setScrollContainerRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
      >
        {actionError ? (
          <div className="border-b border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            {actionError}
          </div>
        ) : null}
        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {isLoading ? "Loading" : emptyStateMessage}
          </div>
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {renderedVirtualRows.map((virtualRow) => (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderRow(rows[virtualRow.index])}
              </div>
            ))}
          </div>
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
