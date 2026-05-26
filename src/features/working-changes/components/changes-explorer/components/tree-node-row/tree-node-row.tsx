import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconMessageCircle,
} from "@/shared/components/icons/icons";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import {
  collectFilesFromTree,
  type ChangesExplorerTreeNode,
} from "@/shared/lib/tree/changes-explorer-tree";
import { memo } from "react";
import { ChangesExplorerStatusIcon } from "../changes-explorer-status-icon/changes-explorer-status-icon";
import { ChangesExplorerTreeNodes } from "../changes-explorer-tree-nodes/changes-explorer-tree-nodes";
import { FileSelectionCheckbox } from "../file-selection-checkbox/file-selection-checkbox";
import { ChangesExplorerCheckboxState, isUntrackedFile } from "../../utils";
import { getFolderExpansionKey } from "../../utils/folder-expansion-key";

const TREE_INDENT_STEP = 18;
const TREE_FOLDER_BASE_INDENT = 10;
const TREE_FILE_BASE_INDENT = 30;

type TreeNodeRowProps = {
  sectionName: string;
  node: ChangesExplorerTreeNode;
  depth: number;
  search: string;
  expanded: Record<string, boolean>;
  selectedPath: string | null;
  showFileCheckboxes: boolean;
  getFileCheckboxState: (
    file: ChangesExplorerFile,
  ) => ChangesExplorerCheckboxState;
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
  fileCommentCounts?: Record<string, number>;
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
  alignCountColumnWithHeaderActions = false,
  fileCommentCounts,
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
          className="flex h-7 w-full items-center gap-1 overflow-hidden px-2 text-left text-sm text-zinc-400 transition-colors hover:bg-background-emphasis"
          style={{
            paddingLeft: `${TREE_FOLDER_BASE_INDENT + depth * TREE_INDENT_STEP}px`,
          }}
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
          <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-zinc-500">
            {isOpen ? (
              <IconChevronDown size={13} />
            ) : (
              <IconChevronRight size={13} />
            )}
          </span>
          <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
            <IconFolder
              size={15}
              className="h-4 w-4 flex-shrink-0 text-slate-300"
            />
          </span>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {showFileCheckboxes && folderFiles.length > 0 ? (
            <FileSelectionCheckbox
              checkboxState={folderCheckboxState}
              onToggle={() => onToggleFolderSelection(node.path, folderFiles)}
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
            alignCountColumnWithHeaderActions={
              alignCountColumnWithHeaderActions
            }
            fileCommentCounts={fileCommentCounts}
          />
        ) : null}
      </div>
    );
  }

  const checkboxState = getFileCheckboxState(node.file);
  const isSelected = selectedPath === node.file.path;
  const commentCount = fileCommentCounts?.[node.file.path] ?? 0;

  return (
    <button
      key={node.file.path}
      type="button"
      data-file-path={node.file.path}
      className={`flex h-7 w-full items-center gap-1.5 overflow-hidden px-2 text-left text-sm transition-colors ${
        isSelected
          ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
          : "text-zinc-400 hover:bg-background-emphasis"
      }`}
      style={{
        paddingLeft: `${TREE_FILE_BASE_INDENT + depth * TREE_INDENT_STEP}px`,
      }}
      onClick={() => onSelectFile(node.file)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectFile(node.file);
        onOpenFileContextMenu(node.file, e.clientX, e.clientY);
      }}
    >
      <ChangesExplorerStatusIcon file={node.file} />
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      {!isUntrackedFile(node.file) ? (
        <div
          className={`ml-2 flex flex-shrink-0 items-center justify-end gap-1.5 text-xs ${
            commentCount > 0
              ? alignCountColumnWithHeaderActions
                ? "w-[5.75rem] pr-2"
                : "w-[4.5rem]"
              : alignCountColumnWithHeaderActions
                ? "w-[4.5rem] pr-2"
                : "w-14"
          }`}
        >
          {commentCount > 0 ? (
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400"
              title={`${commentCount} PR comment${commentCount === 1 ? "" : "s"}`}
              aria-label={`${commentCount} PR comment${commentCount === 1 ? "" : "s"}`}
            >
              <IconMessageCircle size={13} />
            </span>
          ) : null}
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
