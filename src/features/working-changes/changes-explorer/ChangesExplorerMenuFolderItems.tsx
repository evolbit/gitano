import { memo } from "react";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changesExplorerTree";
import { ChangesExplorerCheckboxState } from "./utils";
import { ChangesExplorerMenuButton } from "./ChangesExplorerMenuButton";
import { getShowInFileManagerLabel } from "./utils";

type ChangesExplorerFolderMenuItemsProps = {
  folderPath: string;
  filesInFolder: ChangesExplorerFile[];
  isUntracked: boolean;
  onCloseContextMenu: () => void;
  onToggleFolderSelection: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  onDiscardTrackedFolder: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  onTrashUntrackedFolder: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  getFolderCheckboxState: (
    filesInFolder: ChangesExplorerFile[],
  ) => ChangesExplorerCheckboxState;
};

export const ChangesExplorerFolderMenuItems = memo(
  function ChangesExplorerFolderMenuItems({
    folderPath,
    filesInFolder,
    isUntracked,
    onCloseContextMenu,
    onToggleFolderSelection,
    onDiscardTrackedFolder,
    onTrashUntrackedFolder,
    getFolderCheckboxState,
  }: ChangesExplorerFolderMenuItemsProps) {
    const checkboxState = getFolderCheckboxState(filesInFolder);
    const stageLabel =
      checkboxState === "checked" ? "Unstage Folder" : "Stage Folder";
    const showInFileManagerLabel = getShowInFileManagerLabel();

    return (
      <>
        <ChangesExplorerMenuButton
          onClick={() => {
            onCloseContextMenu();
            onToggleFolderSelection(folderPath, filesInFolder);
          }}
        >
          {stageLabel}
        </ChangesExplorerMenuButton>
        {isUntracked ? (
          <ChangesExplorerMenuButton
            onClick={() => {
              onCloseContextMenu();
              onTrashUntrackedFolder(folderPath, filesInFolder);
            }}
          >
            Trash Folder
          </ChangesExplorerMenuButton>
        ) : (
          <ChangesExplorerMenuButton
            onClick={() => {
              onCloseContextMenu();
              onDiscardTrackedFolder(folderPath, filesInFolder);
            }}
          >
            Discard Changes
          </ChangesExplorerMenuButton>
        )}
        <ChangesExplorerMenuButton disabled>Stash File</ChangesExplorerMenuButton>
        <ChangesExplorerMenuButton disabled>{showInFileManagerLabel}</ChangesExplorerMenuButton>
        {!isUntracked ? (
          <ChangesExplorerMenuButton disabled>View File Blame</ChangesExplorerMenuButton>
        ) : null}
      </>
    );
  },
);
