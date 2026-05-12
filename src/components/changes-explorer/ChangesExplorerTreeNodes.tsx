import { ChangesExplorerTreeNode, ChangesExplorerFile } from "../../utils/changesExplorerTree";
import { memo } from "react";
import { ChangesExplorerCheckboxState } from "./utils";
import { TreeNodeRow } from "./TreeNodeRow";

type ChangesExplorerTreeNodesProps = {
  nodes: ChangesExplorerTreeNode[];
  depth: number;
  search: string;
  expanded: Record<string, boolean>;
  selectedPath: string | null;
  showFileCheckboxes: boolean;
  getFileCheckboxState: (file: ChangesExplorerFile) => ChangesExplorerCheckboxState;
  onSelectFile: (file: ChangesExplorerFile) => void;
  onOpenFileContextMenu: (
    file: ChangesExplorerFile,
    x: number,
    y: number,
  ) => void;
  onOpenFolderContextMenu: (
    folderPath: string,
    files: ChangesExplorerFile[],
    isUntracked: boolean,
    x: number,
    y: number,
  ) => void;
  onToggleFolder: (path: string) => void;
  onToggleFileSelection: (file: ChangesExplorerFile) => void;
  onToggleFolderSelection: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  getFolderCheckboxState: (
    filesInFolder: ChangesExplorerFile[],
  ) => ChangesExplorerCheckboxState;
};

export const ChangesExplorerTreeNodes = memo(function ChangesExplorerTreeNodes({
  nodes,
  depth,
  search,
  expanded,
  selectedPath,
  showFileCheckboxes,
  getFileCheckboxState,
  onSelectFile,
  onOpenFileContextMenu,
  onOpenFolderContextMenu,
  onToggleFolder,
  onToggleFileSelection,
  onToggleFolderSelection,
  getFolderCheckboxState,
}: ChangesExplorerTreeNodesProps) {
  return (
    <>
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.path}
          node={node}
          depth={depth}
          search={search}
          expanded={expanded}
          selectedPath={selectedPath}
          showFileCheckboxes={showFileCheckboxes}
          getFileCheckboxState={getFileCheckboxState}
          onSelectFile={onSelectFile}
          onOpenFileContextMenu={onOpenFileContextMenu}
          onOpenFolderContextMenu={onOpenFolderContextMenu}
          onToggleFolder={onToggleFolder}
          onToggleFileSelection={onToggleFileSelection}
          onToggleFolderSelection={onToggleFolderSelection}
          getFolderCheckboxState={getFolderCheckboxState}
        />
      ))}
    </>
  );
});
