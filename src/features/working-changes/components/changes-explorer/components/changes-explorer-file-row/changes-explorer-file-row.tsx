import { getFileName, getParentPath } from "@/shared/lib/path";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { memo } from "react";
import { ChangesExplorerStatusIcon } from "../changes-explorer-status-icon/changes-explorer-status-icon";
import { FileSelectionCheckbox } from "../file-selection-checkbox/file-selection-checkbox";
import { ChangesExplorerCheckboxState, isUntrackedFile } from "../../utils";
import { IconMessageCircle } from "@/shared/components/icons/icons";

type FileRowProps = {
  file: ChangesExplorerFile;
  selectedPath: string | null;
  showFileCheckboxes: boolean;
  checkboxState: ChangesExplorerCheckboxState;
  onSelectFile: (file: ChangesExplorerFile) => void;
  onOpenFileContextMenu: (
    file: ChangesExplorerFile,
    x: number,
    y: number,
  ) => void;
  onToggleFileSelection: (file: ChangesExplorerFile) => void;
  alignCountColumnWithHeaderActions?: boolean;
  commentCount?: number;
};

export const ChangesExplorerFileRow = memo(function ChangesExplorerFileRow({
  file,
  selectedPath,
  showFileCheckboxes,
  checkboxState,
  onSelectFile,
  onOpenFileContextMenu,
  onToggleFileSelection,
  alignCountColumnWithHeaderActions = false,
  commentCount = 0,
}: FileRowProps) {
  const isSelected = selectedPath === file.path;
  const fileName = getFileName(file.path);
  const parentPath = getParentPath(file.path);

  return (
    <button
      type="button"
      data-file-path={file.path}
      className={`flex h-7 w-full items-center gap-1.5 overflow-hidden border-b border-transparent px-2 text-left text-sm transition-colors ${
        isSelected
          ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
          : "text-zinc-400 hover:bg-background-emphasis"
      }`}
      onClick={() => onSelectFile(file)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectFile(file);
        onOpenFileContextMenu(file, e.clientX, e.clientY);
      }}
    >
      <ChangesExplorerStatusIcon file={file} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-baseline gap-2 overflow-hidden">
          <span className="shrink-0 whitespace-nowrap">{fileName}</span>
          {parentPath ? (
            <span className="min-w-0 flex-1 truncate text-left text-zinc-400 [direction:rtl]">
              {parentPath}
            </span>
          ) : null}
        </div>
      </div>
      {!isUntrackedFile(file) ? (
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
            +{file.insertions}
          </span>
          <span className="min-w-0 text-right text-rose-400">
            -{file.deletions}
          </span>
        </div>
      ) : null}
      {showFileCheckboxes ? (
        <FileSelectionCheckbox
          checkboxState={checkboxState}
          onToggle={() => onToggleFileSelection(file)}
        />
      ) : null}
    </button>
  );
});
