import { useCallback } from "react";
import {
  discardFileChanges,
  stageAll,
  stageFile,
  stageFiles,
  stageLines,
  trashUntrackedFile,
  unstageAll,
  unstageFile,
  unstageFiles,
} from "@/shared/api/git/staging";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { buildAllStageableLineMap } from "@/shared/lib/tree/changes-explorer-tree";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import type { ChangesExplorerProps } from "../types";
import {
  cloneStagedLinesState,
  getCheckboxStateForFile,
  getFolderCheckboxState as computeFolderCheckboxState,
  isUntrackedFile,
  serializeLineSelection,
} from "../utils";

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

export function useChangesExplorerStaging({
  normalizedFiles,
  onImmediateStageChange,
  repoPath,
  scheduleImmediateStageRefresh,
  setActionError,
  showFileCheckboxes,
}: Pick<ChangesExplorerProps, "onImmediateStageChange" | "repoPath"> & {
  normalizedFiles: ChangesExplorerFile[];
  scheduleImmediateStageRefresh: (
    onImmediateStageChange?: () => Promise<void> | void,
  ) => void;
  setActionError: (error: string | null) => void;
  showFileCheckboxes: boolean;
}) {
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
  const isPartiallyStaged = useStagedLinesStore((s) => s.isPartiallyStaged);

  const getCheckboxState = useCallback(
    (file: ChangesExplorerFile) =>
      getCheckboxStateForFile(
        file,
        stagedLines,
        isStagedNewFile,
        isWholeFileStaged,
        isPartiallyStaged,
      ),
    [stagedLines, isStagedNewFile, isWholeFileStaged, isPartiallyStaged],
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

  const applyFileSelectionOptimistic = useCallback(
    (file: ChangesExplorerFile, selected: boolean) => {
      if (!selected) {
        clearStagedLinesForFile(file.path);
        return;
      }

      if (isUntrackedFile(file)) {
        setStagedNewFile(file.path, true);
        return;
      }

      setLineSelectionForFile(file.path, {});
      setWholeFileStaged(file.path, true);
    },
    [
      clearStagedLinesForFile,
      setLineSelectionForFile,
      setStagedNewFile,
      setWholeFileStaged,
    ],
  );

  const toggleAllFilesSelection = useCallback(async () => {
    if (!repoPath || !showFileCheckboxes || normalizedFiles.length === 0)
      return;

    await runStagedLinesMutation(async () => {
      if (areAllFilesFullySelected) {
        normalizedFiles.forEach((file) =>
          applyFileSelectionOptimistic(file, false),
        );
        await unstageAll(repoPath);
      } else {
        normalizedFiles.forEach((file) =>
          applyFileSelectionOptimistic(file, true),
        );
        await stageAll(repoPath);
      }
    });
  }, [
    areAllFilesFullySelected,
    applyFileSelectionOptimistic,
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

        if (isUntrackedFile(file) || file.status === "deleted") {
          if (checkboxState === "checked") {
            applyFileSelectionOptimistic(file, false);
            await unstageFile(repoPath, file.path);
          } else {
            applyFileSelectionOptimistic(file, true);
            await stageFile(repoPath, file.path);
          }
          return;
        }

        if (checkboxState === "checked") {
          applyFileSelectionOptimistic(file, false);
          if (hasDiffHunks(file)) {
            await stageLines(repoPath, file.path, {});
          } else {
            await unstageFile(repoPath, file.path);
          }
          return;
        }

        applyFileSelectionOptimistic(file, true);
        if (!hasDiffHunks(file)) {
          await stageFile(repoPath, file.path);
          return;
        }
        await stageLines(repoPath, file.path, serializeAllStageableLines(file));
      });
    },
    [
      applyFileSelectionOptimistic,
      getCheckboxState,
      repoPath,
      runStagedLinesMutation,
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
          uniqueFilesInFolder.forEach((file) =>
            applyFileSelectionOptimistic(file, false),
          );
          await unstageFiles(
            repoPath,
            uniqueFilesInFolder.map((file) => file.path),
          );
        } else {
          uniqueFilesInFolder.forEach((file) =>
            applyFileSelectionOptimistic(file, true),
          );
          await stageFiles(
            repoPath,
            uniqueFilesInFolder.map((file) => file.path),
          );
        }
      });
    },
    [
      applyFileSelectionOptimistic,
      getFolderCheckboxState,
      repoPath,
      runStagedLinesMutation,
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

  return {
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
  };
}
