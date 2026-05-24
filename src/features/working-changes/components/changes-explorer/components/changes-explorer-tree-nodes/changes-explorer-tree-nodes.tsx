import type {
  ChangesExplorerFile,
  ChangesExplorerTreeNode,
} from "@/shared/lib/tree/changes-explorer-tree";
import { memo } from "react";
import { ChangesExplorerCheckboxState } from "../../utils";
import { TreeNodeRow } from "../tree-node-row/tree-node-row";

type ChangesExplorerTreeNodesProps = {
  sectionName?: string;
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
  onToggleFolder: (expansionKey: string) => void;
  onToggleFileSelection: (file: ChangesExplorerFile) => void;
  onToggleFolderSelection: (
    folderPath: string,
    filesInFolder: ChangesExplorerFile[],
  ) => void;
  getFolderCheckboxState: (
    filesInFolder: ChangesExplorerFile[],
  ) => ChangesExplorerCheckboxState;
  alignCountColumnWithHeaderActions?: boolean;
};

export const ChangesExplorerTreeNodes = memo(function ChangesExplorerTreeNodes({
  sectionName = "default",
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
  alignCountColumnWithHeaderActions = false,
}: ChangesExplorerTreeNodesProps) {
  return (
    <>
      {nodes.map((node) => (
        <TreeNodeRow
          key={`${sectionName}:${node.path}`}
          sectionName={sectionName}
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
          alignCountColumnWithHeaderActions={alignCountColumnWithHeaderActions}
        />
      ))}
    </>
  );
});
