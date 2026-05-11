import { memo } from "react";
import { ChangesExplorerFile } from "../../utils/changesExplorerTree";
import { ChangesExplorerCheckboxState } from "./utils";
import { ChangesExplorerMenuButton } from "./ChangesExplorerMenuButton";
import { getShowInFileManagerLabel } from "./utils";

type ChangesExplorerFileMenuItemsProps = {
  file: ChangesExplorerFile;
  onCloseContextMenu: () => void;
  onToggleFileSelection: (file: ChangesExplorerFile) => void;
  onDiscardTrackedFile: (file: ChangesExplorerFile) => void;
  onTrashUntrackedFile: (file: ChangesExplorerFile) => void;
  getCheckboxState: (file: ChangesExplorerFile) => ChangesExplorerCheckboxState;
};

export const ChangesExplorerFileMenuItems = memo(function ChangesExplorerFileMenuItems({
  file,
  onCloseContextMenu,
  onToggleFileSelection,
  onDiscardTrackedFile,
  onTrashUntrackedFile,
  getCheckboxState,
}: ChangesExplorerFileMenuItemsProps) {
  const checkboxState = getCheckboxState(file);
  const isUntracked = file.status === "added" && "hunks" in file;
  const stageLabel = checkboxState === "checked" ? "Unstage File" : "Stage File";
  const showInFileManagerLabel = getShowInFileManagerLabel();

  return (
    <>
      <ChangesExplorerMenuButton
        onClick={() => {
          onCloseContextMenu();
          onToggleFileSelection(file);
        }}
      >
        {stageLabel}
      </ChangesExplorerMenuButton>
      {isUntracked ? (
        <ChangesExplorerMenuButton
          onClick={() => {
            onCloseContextMenu();
            onTrashUntrackedFile(file);
          }}
        >
          Trash File
        </ChangesExplorerMenuButton>
      ) : (
        <ChangesExplorerMenuButton
          onClick={() => {
            onCloseContextMenu();
            onDiscardTrackedFile(file);
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
});
