import ReactDOM from "react-dom";
import { memo, type RefObject } from "react";
import { ChangesExplorerViewMode, ContextMenuScope } from "./types";
import { ChangesExplorerCheckboxState } from "./utils";
import { ChangesExplorerFile } from "../../utils/changesExplorerTree";
import { ChangesExplorerMenuButton } from "./ChangesExplorerMenuButton";
import { ChangesExplorerFileMenuItems } from "./ChangesExplorerMenuFileItems";
import { ChangesExplorerFolderMenuItems } from "./ChangesExplorerMenuFolderItems";
import { ChangesExplorerModalMenuItems } from "./ChangesExplorerMenuModalItems";

type MenuProps = {
  activeContextMenu: ContextMenuScope | null;
  menuPos: { x: number; y: number } | null;
  menuRef: RefObject<HTMLDivElement>;
  surface: "main" | "modal";
  viewMode: ChangesExplorerViewMode;
  onViewModeChange: (mode: ChangesExplorerViewMode) => void;
  onCloseContextMenu: () => void;
  onToggleFileSelection: (file: ChangesExplorerFile) => void;
  onToggleFolderSelection: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  onDiscardTrackedFile: (file: ChangesExplorerFile) => void;
  onDiscardTrackedFolder: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  onTrashUntrackedFile: (file: ChangesExplorerFile) => void;
  onTrashUntrackedFolder: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  getCheckboxState: (file: ChangesExplorerFile) => ChangesExplorerCheckboxState;
  getFolderCheckboxState: (
    filesInFolder: ChangesExplorerFile[],
  ) => ChangesExplorerCheckboxState;
};

const ChangesExplorerMenuViewModeItems = memo(function ChangesExplorerMenuViewModeItems({
  viewMode,
  onViewModeChange,
  onCloseContextMenu,
}: {
  viewMode: ChangesExplorerViewMode;
  onViewModeChange: (mode: ChangesExplorerViewMode) => void;
  onCloseContextMenu: () => void;
}) {
  return (
    <>
      {(["flat", "tree"] as ChangesExplorerViewMode[]).map((mode) => (
        <ChangesExplorerMenuButton
          key={mode}
          active={viewMode === mode}
          onClick={() => {
            onViewModeChange(mode);
            onCloseContextMenu();
          }}
        >
          {mode === "flat" ? "Flat View" : "Tree View"}
        </ChangesExplorerMenuButton>
      ))}
    </>
  );
});

const ChangesExplorerMenuScopeContent = memo(function ChangesExplorerMenuScopeContent({
  activeContextMenu,
  onCloseContextMenu,
  onToggleFileSelection,
  onToggleFolderSelection,
  onDiscardTrackedFile,
  onDiscardTrackedFolder,
  onTrashUntrackedFile,
  onTrashUntrackedFolder,
  getCheckboxState,
  getFolderCheckboxState,
}: {
  activeContextMenu: ContextMenuScope;
  onCloseContextMenu: () => void;
  onToggleFileSelection: (file: ChangesExplorerFile) => void;
  onToggleFolderSelection: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  onDiscardTrackedFile: (file: ChangesExplorerFile) => void;
  onDiscardTrackedFolder: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  onTrashUntrackedFile: (file: ChangesExplorerFile) => void;
  onTrashUntrackedFolder: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  getCheckboxState: (file: ChangesExplorerFile) => ChangesExplorerCheckboxState;
  getFolderCheckboxState: (
    filesInFolder: ChangesExplorerFile[],
  ) => ChangesExplorerCheckboxState;
}) {
  if (activeContextMenu.kind === "file") {
    return (
      <ChangesExplorerFileMenuItems
        file={activeContextMenu.file}
        onCloseContextMenu={onCloseContextMenu}
        onToggleFileSelection={onToggleFileSelection}
        onDiscardTrackedFile={onDiscardTrackedFile}
        onTrashUntrackedFile={onTrashUntrackedFile}
        getCheckboxState={getCheckboxState}
      />
    );
  }

  if (activeContextMenu.kind !== "folder") {
    return null;
  }

  return (
    <ChangesExplorerFolderMenuItems
      folderPath={activeContextMenu.folderPath}
      filesInFolder={activeContextMenu.files}
      isUntracked={activeContextMenu.isUntracked}
      onCloseContextMenu={onCloseContextMenu}
      onToggleFolderSelection={onToggleFolderSelection}
      onDiscardTrackedFolder={onDiscardTrackedFolder}
      onTrashUntrackedFolder={onTrashUntrackedFolder}
      getFolderCheckboxState={getFolderCheckboxState}
    />
  );
});

export const ChangesExplorerMenu = memo(function ChangesExplorerMenu({
  activeContextMenu,
  menuPos,
  menuRef,
  surface,
  viewMode,
  onViewModeChange,
  onCloseContextMenu,
  onToggleFileSelection,
  onToggleFolderSelection,
  onDiscardTrackedFile,
  onDiscardTrackedFolder,
  onTrashUntrackedFile,
  onTrashUntrackedFolder,
  getCheckboxState,
  getFolderCheckboxState,
}: MenuProps) {
  if (!activeContextMenu || !menuPos) return null;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100001] min-w-[220px] rounded border border-zinc-700 bg-zinc-900/95 py-1 text-sm text-zinc-200 shadow-lg"
      style={{ left: menuPos.x, top: menuPos.y }}
    >
      {activeContextMenu.kind === "pane" ? (
        <ChangesExplorerModalMenuItems />
      ) : null}
      {activeContextMenu.kind === "pane" ? (
        <ChangesExplorerMenuViewModeItems
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onCloseContextMenu={onCloseContextMenu}
        />
      ) : (
        <ChangesExplorerMenuScopeContent
          activeContextMenu={activeContextMenu}
          onCloseContextMenu={onCloseContextMenu}
          onToggleFileSelection={onToggleFileSelection}
          onToggleFolderSelection={onToggleFolderSelection}
          onDiscardTrackedFile={onDiscardTrackedFile}
          onDiscardTrackedFolder={onDiscardTrackedFolder}
          onTrashUntrackedFile={onTrashUntrackedFile}
          onTrashUntrackedFolder={onTrashUntrackedFolder}
          getCheckboxState={getCheckboxState}
          getFolderCheckboxState={getFolderCheckboxState}
        />
      )}
    </div>,
    document.body,
  );
});
