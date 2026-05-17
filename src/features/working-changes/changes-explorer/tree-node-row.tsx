import {
  collectFilesFromTree,
  type ChangesExplorerTreeNode,
} from "@/shared/lib/tree/changes-explorer-tree";
import { isUntrackedFile } from "./utils";
import { ChangesExplorerCheckboxState } from "./utils";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { ChangesExplorerStatusIcon } from "./changes-explorer-status-icon";
import { ChangesExplorerTreeNodes } from "./changes-explorer-tree-nodes";
import { FileSelectionCheckbox } from "./file-selection-checkbox";
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
} from "@/components/icons";
import { memo } from "react";
import { getFolderExpansionKey } from "./utils/folder-expansion-key";

type TreeNodeRowProps = {
  sectionName: string;
  node: ChangesExplorerTreeNode;
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
};

export const TreeNodeRow = memo(function TreeNodeRow({
  sectionName,
  node,
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
}: TreeNodeRowProps) {
  if (node.kind === "folder") {
    const expansionKey = getFolderExpansionKey(sectionName, node.path);
    const isOpen = search ? true : (expanded[expansionKey] ?? true);
    const folderFiles = collectFilesFromTree(node.children);
    const folderCheckboxState = getFolderCheckboxState(folderFiles);
    const sectionIsUntracked =
      folderFiles.length > 0 &&
      folderFiles.every((file) => isUntrackedFile(file));

    return (
      <div key={node.path}>
        <button
          type="button"
          className="flex w-full items-center gap-1 overflow-hidden px-3 py-1.5 text-left text-sm text-zinc-400 transition-colors hover:bg-background-emphasis"
          style={{ paddingLeft: `${12 + depth * 22}px` }}
          onClick={() => onToggleFolder(expansionKey)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenFolderContextMenu(
              node.path,
              folderFiles,
              sectionIsUntracked,
              e.clientX,
              e.clientY,
            );
          }}
        >
          <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
            {isOpen ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )}
          </span>
          <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
            <IconFolder size={16} className="h-4 w-4 flex-shrink-0 text-slate-300" />
          </span>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {showFileCheckboxes && folderFiles.length > 0 ? (
            <FileSelectionCheckbox
              checkboxState={folderCheckboxState}
              onToggle={() =>
                onToggleFolderSelection(node.path, folderFiles)
              }
            />
          ) : null}
        </button>
        {isOpen ? (
          <ChangesExplorerTreeNodes
            nodes={node.children}
            sectionName={sectionName}
            depth={depth + 1}
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
        ) : null}
      </div>
    );
  }

  const checkboxState = getFileCheckboxState(node.file);
  const isSelected = selectedPath === node.file.path;

  return (
    <button
      key={node.file.path}
      type="button"
      data-file-path={node.file.path}
      className={`flex w-full items-center gap-2 overflow-hidden px-3 py-1.5 text-left text-sm transition-colors ${
        isSelected
          ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
          : "text-zinc-400 hover:bg-background-emphasis"
      }`}
      style={{ paddingLeft: `${40 + depth * 22}px` }}
      onClick={() => onSelectFile(node.file)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectFile(node.file);
        onOpenFileContextMenu(node.file, e.clientX, e.clientY);
      }}
    >
      <ChangesExplorerStatusIcon file={node.file} />
      <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
      {!isUntrackedFile(node.file) ? (
        <div className="ml-3 flex w-16 flex-shrink-0 items-center justify-end gap-2 text-xs">
          <span className="min-w-0 text-right text-lime-400">
            +{node.file.insertions}
          </span>
          <span className="min-w-0 text-right text-rose-400">
            -{node.file.deletions}
          </span>
        </div>
      ) : null}
      {showFileCheckboxes ? (
        <FileSelectionCheckbox
          checkboxState={checkboxState}
          onToggle={() => onToggleFileSelection(node.file)}
        />
      ) : null}
    </button>
  );
});
