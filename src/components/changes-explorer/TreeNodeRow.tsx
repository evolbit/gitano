import { collectFilesFromTree, ChangesExplorerTreeNode } from "../../utils/changesExplorerTree";
import { isUntrackedFile } from "./utils";
import { ChangesExplorerCheckboxState } from "./utils";
import { ChangesExplorerFile } from "../../utils/changesExplorerTree";
import { ChangesExplorerStatusIcon } from "./ChangesExplorerStatusIcon";
import { ChangesExplorerTreeNodes } from "./ChangesExplorerTreeNodes";
import { FileSelectionCheckbox } from "./FileSelectionCheckbox";
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
} from "../icons";
import { memo } from "react";

type TreeNodeRowProps = {
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
  onToggleFolder: (path: string) => void;
  onToggleFileSelection: (file: ChangesExplorerFile) => void;
};

export const TreeNodeRow = memo(function TreeNodeRow({
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
}: TreeNodeRowProps) {
  if (node.kind === "folder") {
    const isOpen = search ? true : (expanded[node.path] ?? true);
    const folderFiles = collectFilesFromTree(node.children);
    const sectionIsUntracked =
      folderFiles.length > 0 &&
      folderFiles.every((file) => isUntrackedFile(file));

    return (
      <div key={node.path}>
        <button
          type="button"
          className="flex w-full items-center gap-1 overflow-hidden px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-background-emphasis"
          style={{ paddingLeft: `${12 + depth * 22}px` }}
          onClick={() => onToggleFolder(node.path)}
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
        </button>
        {isOpen ? (
          <ChangesExplorerTreeNodes
            nodes={node.children}
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
          : "text-foreground hover:bg-background-emphasis"
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
