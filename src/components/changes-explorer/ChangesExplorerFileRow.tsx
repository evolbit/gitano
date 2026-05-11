import { getFileName, getParentPath } from "../../utils/path";
import { ChangesExplorerFile } from "../../utils/changesExplorerTree";
import { memo } from "react";
import { ChangesExplorerCheckboxState } from "./utils";
import { isUntrackedFile } from "./utils";
import { FileSelectionCheckbox } from "./FileSelectionCheckbox";
import { ChangesExplorerStatusIcon } from "./ChangesExplorerStatusIcon";

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
};

export const ChangesExplorerFileRow = memo(function ChangesExplorerFileRow({
  file,
  selectedPath,
  showFileCheckboxes,
  checkboxState,
  onSelectFile,
  onOpenFileContextMenu,
  onToggleFileSelection,
}: FileRowProps) {
  const isSelected = selectedPath === file.path;
  const fileName = getFileName(file.path);
  const parentPath = getParentPath(file.path);

  return (
    <button
      type="button"
      data-file-path={file.path}
      className={`flex w-full items-center gap-2 overflow-hidden border-b border-transparent px-3 py-2 text-left text-sm transition-colors ${
        isSelected
          ? "bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400"
          : "text-foreground hover:bg-background-emphasis"
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
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-medium">{fileName}</span>
          {parentPath ? (
            <span className="truncate text-muted-foreground">{parentPath}</span>
          ) : null}
        </div>
      </div>
      {!isUntrackedFile(file) ? (
        <div className="ml-3 flex w-16 flex-shrink-0 items-center justify-end gap-2 text-xs">
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
