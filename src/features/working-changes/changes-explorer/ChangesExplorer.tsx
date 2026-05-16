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
import { useStagedLinesStore } from "@/features/working-changes/stores/stagingStore";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changesExplorerTree";
import {
  buildAllStageableLineMap,
  buildCompressedTree,
} from "@/shared/lib/tree/changesExplorerTree";
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
import { ChangesExplorerFileRow } from "./ChangesExplorerFileRow";
import { ChangesExplorerSection } from "./ChangesExplorerSection";
import { ChangesExplorerTreeNodes } from "./ChangesExplorerTreeNodes";
import { ChangesExplorerMenu } from "./menu";
import { useChangesExplorerBehavior } from "./useChangesExplorerBehavior";
import {
  ChangesExplorerProps,
} from "./types";
import {
  IconBinaryTree2,
  IconDotsVertical,
  IconLayoutList,
  IconSearch,
} from "@/components/icons";

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
    setActionError(null);

    const previousStagedLines = cloneStagedLinesState(
      useStagedLinesStore.getState().stagedLines,
    );

    try {
      if (areAllFilesFullySelected) {
        applyUnstageAllOptimistic(normalizedFiles);
        await unstageAll(repoPath);
      } else {
        applyStageAllOptimistic(normalizedFiles);
        await stageAll(repoPath);
      }

      scheduleImmediateStageRefresh(onImmediateStageChange);
    } catch (error) {
      useStagedLinesStore.setState({ stagedLines: previousStagedLines });
      setActionError(String(error));
    }
  }, [
    areAllFilesFullySelected,
    applyStageAllOptimistic,
    applyUnstageAllOptimistic,
    normalizedFiles,
    onImmediateStageChange,
    repoPath,
    showFileCheckboxes,
    scheduleImmediateStageRefresh,
    setActionError,
  ]);

  const toggleFileSelection = useCallback(
    async (file: ChangesExplorerFile) => {
      if (!repoPath) return;
      setActionError(null);
      const previousStagedLines = cloneStagedLinesState(
        useStagedLinesStore.getState().stagedLines,
      );

      try {
        const checkboxState = getCheckboxState(file);

        if (isUntrackedFile(file)) {
          if (checkboxState === "checked") {
            setStagedNewFile(file.path, false);
            await unstageFile(repoPath, file.path);
          } else {
            setStagedNewFile(file.path, true);
            await stageFile(repoPath, file.path);
          }
          scheduleImmediateStageRefresh(onImmediateStageChange);
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
          scheduleImmediateStageRefresh(onImmediateStageChange);
          return;
        }

        if (checkboxState === "checked") {
          clearStagedLinesForFile(file.path);
          if ("hunks" in file && file.hunks.length > 0) {
            await stageLines(repoPath, file.path, {});
          } else {
            await unstageFile(repoPath, file.path);
          }
          scheduleImmediateStageRefresh(onImmediateStageChange);
          return;
        }

        const nextSelection = buildAllStageableLineMap(file);
        setWholeFileStaged(file.path, true);
        setLineSelectionForFile(file.path, {});
        await stageLines(
          repoPath,
          file.path,
          serializeLineSelection(
            Object.fromEntries(
              Object.entries(nextSelection).map(([hunkIdx, lineIdxs]) => [
                Number(hunkIdx),
                new Set(lineIdxs),
              ]),
            ) as Record<number, Set<number>>,
          ),
        );
        scheduleImmediateStageRefresh(onImmediateStageChange);
      } catch (error) {
        useStagedLinesStore.setState({ stagedLines: previousStagedLines });
        setActionError(String(error));
      }
    },
    [
      clearStagedLinesForFile,
      getCheckboxState,
      onImmediateStageChange,
      repoPath,
      setLineSelectionForFile,
      setStagedNewFile,
      setWholeFileStaged,
      scheduleImmediateStageRefresh,
      setActionError,
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
      setActionError(null);
      const previousStagedLines = cloneStagedLinesState(
        useStagedLinesStore.getState().stagedLines,
      );
      const uniqueFilesInFolder = Array.from(
        new Map(filesInFolder.map((file) => [file.path, file])).values(),
      );

      try {
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

        scheduleImmediateStageRefresh(onImmediateStageChange);
      } catch (error) {
        useStagedLinesStore.setState({ stagedLines: previousStagedLines });
        setActionError(String(error));
      }
    },
    [
      clearStagedLinesForFile,
      getFolderCheckboxState,
      onImmediateStageChange,
      repoPath,
      setLineSelectionForFile,
      setStagedNewFile,
      setWholeFileStaged,
      scheduleImmediateStageRefresh,
      setActionError,
    ],
  );

  const handleDiscardTrackedFolder = useCallback(
    async (folderPath: string, filesInFolder: ChangesExplorerFile[]) => {
      if (!repoPath) return;
      setActionError(null);

      try {
        filesInFolder.forEach((file) => clearStagedLinesForFile(file.path));
        await discardFileChanges(repoPath, folderPath);
        scheduleImmediateStageRefresh(onImmediateStageChange);
      } catch (error) {
        setActionError(String(error));
      }
    },
    [clearStagedLinesForFile, onImmediateStageChange, repoPath, scheduleImmediateStageRefresh, setActionError],
  );

  const handleTrashUntrackedFolder = useCallback(
    async (folderPath: string, filesInFolder: ChangesExplorerFile[]) => {
      if (!repoPath) return;
      setActionError(null);

      try {
        filesInFolder.forEach((file) => clearStagedLinesForFile(file.path));
        await trashUntrackedFile(repoPath, folderPath);
        scheduleImmediateStageRefresh(onImmediateStageChange);
      } catch (error) {
        setActionError(String(error));
      }
    },
    [clearStagedLinesForFile, onImmediateStageChange, repoPath, scheduleImmediateStageRefresh, setActionError],
  );

  const handleDiscardTrackedFile = useCallback(
    async (file: ChangesExplorerFile) => {
      if (!repoPath) return;
      setActionError(null);

      try {
        clearStagedLinesForFile(file.path);
        await discardFileChanges(repoPath, file.path);
        scheduleImmediateStageRefresh(onImmediateStageChange);
      } catch (error) {
        setActionError(String(error));
      }
    },
    [clearStagedLinesForFile, onImmediateStageChange, repoPath, scheduleImmediateStageRefresh, setActionError],
  );

  const handleTrashUntrackedFile = useCallback(
    async (file: ChangesExplorerFile) => {
      if (!repoPath) return;
      setActionError(null);

      try {
        clearStagedLinesForFile(file.path);
        await trashUntrackedFile(repoPath, file.path);
        scheduleImmediateStageRefresh(onImmediateStageChange);
      } catch (error) {
        setActionError(String(error));
      }
    },
    [clearStagedLinesForFile, onImmediateStageChange, repoPath, scheduleImmediateStageRefresh, setActionError],
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
                showFileCheckboxes && repoPath && normalizedFiles.length > 0
                  ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  : "bg-zinc-800 text-zinc-400"
              }`}
              onClick={() => {
                void toggleAllFilesSelection();
              }}
              disabled={
                !showFileCheckboxes || !repoPath || normalizedFiles.length === 0
              }
            >
              {areAllFilesFullySelected ? "Unstage All" : "Stage All"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-b border-border bg-background-emphasis p-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              ref={searchInputRef}
              type="text"
              className="w-full rounded border border-border bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          {surface === "main" ? (
            <div className="flex items-center overflow-hidden rounded border border-border bg-background">
              {(
                [
                  {
                    mode: "flat" as const,
                    label: "Flat View",
                    icon: <IconLayoutList size={15} />,
                  },
                  {
                    mode: "tree" as const,
                    label: "Tree View",
                    icon: <IconBinaryTree2 size={15} />,
                  },
                ] as const
              ).map((option) => {
                const active = viewMode === option.mode;
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
                    {option.icon}
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
