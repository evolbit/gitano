import { useDeferredValue, useMemo, useState, useCallback } from "react";
import {
  discardFileChanges,
  stageAll,
  stageFile,
  stageLines,
  trashUntrackedFile,
  unstageAll,
  unstageFile,
} from "@/shared/api/git/staging";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import {
  buildAllStageableLineMap,
  buildCompressedTree,
} from "@/shared/lib/tree/changes-explorer-tree";
import {
  fileMatchesSearch,
  normalizeFiles,
  partitionFiles,
  getCheckboxStateForFile,
  getFolderCheckboxState as computeFolderCheckboxState,
  isUntrackedFile,
  cloneStagedLinesState,
  serializeLineSelection,
} from "./utils";
import { ChangesExplorerFileRow } from "./changes-explorer-file-row";
import { ChangesExplorerSection } from "./changes-explorer-section";
import { ChangesExplorerTreeNodes } from "./changes-explorer-tree-nodes";
import { ChangesExplorerMenu } from "./menu";
import { useChangesExplorerBehavior } from "./use-changes-explorer-behavior";
import type { ChangesExplorerProps } from "./types";
import {
  IconBinaryTree2,
  IconDotsVertical,
  IconLayoutList,
  IconSearch,
} from "@/components/icons";

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

type PathMutation = (repoPath: string, path: string) => Promise<unknown>;

function uniqueFilesByPath(files: ChangesExplorerFile[]) {
  return Array.from(new Map(files.map((file) => [file.path, file])).values());
}

function hasDiffHunks(file: ChangesExplorerFile) {
  return "hunks" in file && file.hunks.length > 0;
}

function serializeAllStageableLines(file: ChangesExplorerFile) {
  const allStageableLines = buildAllStageableLineMap(file);
  const stagedLineSets = Object.fromEntries(
    Object.entries(allStageableLines).map(([hunkIdx, lineIdxs]) => [
      Number(hunkIdx),
      new Set(lineIdxs),
    ]),
  ) as Record<number, Set<number>>;

  return serializeLineSelection(stagedLineSets);
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
}: ChangesExplorerProps) {
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

  const stagedLines = useStagedLinesStore((s) => s.stagedLines);
  const clearStagedLinesForFile = useStagedLinesStore(
    (s) => s.clearStagedLinesForFile,
  );
  const setLineSelectionForFile = useStagedLinesStore(
    (s) => s.setLineSelectionForFile,
  );
  const setStagedNewFile = useStagedLinesStore((s) => s.setStagedNewFile);
  const isStagedNewFile = useStagedLinesStore((s) => s.isStagedNewFile);
  const setWholeFileStaged = useStagedLinesStore((s) => s.setWholeFileStaged);
  const isWholeFileStaged = useStagedLinesStore((s) => s.isWholeFileStaged);

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

  const getCheckboxState = useCallback(
    (file: ChangesExplorerFile) =>
      getCheckboxStateForFile(
        file,
        stagedLines,
        isStagedNewFile,
        isWholeFileStaged,
      ),
    [stagedLines, isStagedNewFile, isWholeFileStaged],
  );

  const areAllFilesFullySelected =
    showFileCheckboxes &&
    normalizedFiles.length > 0 &&
    normalizedFiles.every((file) => getCheckboxState(file) === "checked");

  const runStagedLinesMutation = useCallback(
    async (mutation: () => Promise<void>) => {
      setActionError(null);
      const previousStagedLines = cloneStagedLinesState(
        useStagedLinesStore.getState().stagedLines,
      );

      try {
        await mutation();
        scheduleImmediateStageRefresh(onImmediateStageChange);
      } catch (error) {
        useStagedLinesStore.setState({ stagedLines: previousStagedLines });
        setActionError(String(error));
      }
    },
    [onImmediateStageChange, scheduleImmediateStageRefresh, setActionError],
  );

  const runPathMutation = useCallback(
    async (
      targetPath: string,
      filesToClear: ChangesExplorerFile[],
      mutation: PathMutation,
    ) => {
      if (!repoPath) return;
      setActionError(null);

      try {
        filesToClear.forEach((file) => clearStagedLinesForFile(file.path));
        await mutation(repoPath, targetPath);
        scheduleImmediateStageRefresh(onImmediateStageChange);
      } catch (error) {
        setActionError(String(error));
      }
    },
    [
      clearStagedLinesForFile,
      onImmediateStageChange,
      repoPath,
      scheduleImmediateStageRefresh,
      setActionError,
    ],
  );

  const applyStageAllOptimistic = useCallback(
    (targetFiles: ChangesExplorerFile[]) => {
      targetFiles.forEach((file) => {
        if (isUntrackedFile(file)) {
          setStagedNewFile(file.path, true);
          return;
        }

        setLineSelectionForFile(file.path, {});
        setWholeFileStaged(file.path, true);
      });
    },
    [setLineSelectionForFile, setStagedNewFile, setWholeFileStaged],
  );

  const applyUnstageAllOptimistic = useCallback(
    (targetFiles: ChangesExplorerFile[]) => {
      targetFiles.forEach((file) => {
        clearStagedLinesForFile(file.path);
      });
    },
    [clearStagedLinesForFile],
  );

  const toggleAllFilesSelection = useCallback(async () => {
    if (!repoPath || !showFileCheckboxes || normalizedFiles.length === 0)
      return;

    await runStagedLinesMutation(async () => {
      if (areAllFilesFullySelected) {
        applyUnstageAllOptimistic(normalizedFiles);
        await unstageAll(repoPath);
      } else {
        applyStageAllOptimistic(normalizedFiles);
        await stageAll(repoPath);
      }
    });
  }, [
    areAllFilesFullySelected,
    applyStageAllOptimistic,
    applyUnstageAllOptimistic,
    normalizedFiles,
    repoPath,
    runStagedLinesMutation,
    showFileCheckboxes,
  ]);

  const toggleFileSelection = useCallback(
    async (file: ChangesExplorerFile) => {
      if (!repoPath) return;

      await runStagedLinesMutation(async () => {
        const checkboxState = getCheckboxState(file);

        if (isUntrackedFile(file)) {
          if (checkboxState === "checked") {
            setStagedNewFile(file.path, false);
            await unstageFile(repoPath, file.path);
          } else {
            setStagedNewFile(file.path, true);
            await stageFile(repoPath, file.path);
          }
          return;
        }

        if (file.status === "deleted") {
          if (checkboxState === "checked") {
            clearStagedLinesForFile(file.path);
            setWholeFileStaged(file.path, false);
            await unstageFile(repoPath, file.path);
          } else {
            setWholeFileStaged(file.path, true);
            await stageFile(repoPath, file.path);
          }
          return;
        }

        if (checkboxState === "checked") {
          clearStagedLinesForFile(file.path);
          if (hasDiffHunks(file)) {
            await stageLines(repoPath, file.path, {});
          } else {
            await unstageFile(repoPath, file.path);
          }
          return;
        }

        setWholeFileStaged(file.path, true);
        setLineSelectionForFile(file.path, {});
        await stageLines(repoPath, file.path, serializeAllStageableLines(file));
      });
    },
    [
      clearStagedLinesForFile,
      getCheckboxState,
      repoPath,
      runStagedLinesMutation,
      setLineSelectionForFile,
      setStagedNewFile,
      setWholeFileStaged,
    ],
  );

  const getFolderCheckboxState = useCallback(
    (filesInFolder: ChangesExplorerFile[]) =>
      computeFolderCheckboxState(filesInFolder, getCheckboxState),
    [getCheckboxState],
  );

  const toggleFolderSelection = useCallback(
    async (_folderPath: string, filesInFolder: ChangesExplorerFile[]) => {
      if (!repoPath || filesInFolder.length === 0) return;
      const uniqueFilesInFolder = uniqueFilesByPath(filesInFolder);

      await runStagedLinesMutation(async () => {
        if (getFolderCheckboxState(uniqueFilesInFolder) === "checked") {
          for (const file of uniqueFilesInFolder) {
            clearStagedLinesForFile(file.path);
            await unstageFile(repoPath, file.path);
          }
        } else {
          for (const file of uniqueFilesInFolder) {
            if (isUntrackedFile(file)) {
              setStagedNewFile(file.path, true);
            } else {
              setLineSelectionForFile(file.path, {});
              setWholeFileStaged(file.path, true);
            }

            await stageFile(repoPath, file.path);
          }
        }
      });
    },
    [
      clearStagedLinesForFile,
      getFolderCheckboxState,
      repoPath,
      runStagedLinesMutation,
      setLineSelectionForFile,
      setStagedNewFile,
      setWholeFileStaged,
    ],
  );

  const handleDiscardTrackedFolder = useCallback(
    async (folderPath: string, filesInFolder: ChangesExplorerFile[]) => {
      await runPathMutation(folderPath, filesInFolder, discardFileChanges);
    },
    [runPathMutation],
  );

  const handleTrashUntrackedFolder = useCallback(
    async (folderPath: string, filesInFolder: ChangesExplorerFile[]) => {
      await runPathMutation(folderPath, filesInFolder, trashUntrackedFile);
    },
    [runPathMutation],
  );

  const handleDiscardTrackedFile = useCallback(
    async (file: ChangesExplorerFile) => {
      await runPathMutation(file.path, [file], discardFileChanges);
    },
    [runPathMutation],
  );

  const handleTrashUntrackedFile = useCallback(
    async (file: ChangesExplorerFile) => {
      await runPathMutation(file.path, [file], trashUntrackedFile);
    },
    [runPathMutation],
  );

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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
