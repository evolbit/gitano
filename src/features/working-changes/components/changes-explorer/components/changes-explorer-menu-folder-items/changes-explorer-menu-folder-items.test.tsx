import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { ChangesExplorerFolderMenuItems } from "./changes-explorer-menu-folder-items";

const folderFiles: ChangesExplorerFile[] = [
  { path: "src/app.ts", status: "modified", insertions: 1, deletions: 1 },
];

const conflictedFolderFiles: ChangesExplorerFile[] = [
  {
    path: "src/conflict.ts",
    status: ChangeType.Conflicted,
    insertions: 0,
    deletions: 0,
  },
];

describe("ChangesExplorerFolderMenuItems", () => {
  afterEach(() => {
    cleanup();
  });

  it("toggles folder staging and discards tracked folder changes", () => {
    const onToggleFolderSelection = vi.fn();
    const onDiscardTrackedFolder = vi.fn();
    const onCloseContextMenu = vi.fn();

    render(
      <ChangesExplorerFolderMenuItems
        folderPath="src"
        filesInFolder={folderFiles}
        isUntracked={false}
        onCloseContextMenu={onCloseContextMenu}
        onToggleFolderSelection={onToggleFolderSelection}
        onDiscardTrackedFolder={onDiscardTrackedFolder}
        onTrashUntrackedFolder={vi.fn()}
        getFolderCheckboxState={() => "unchecked"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stage Folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard Changes" }));

    expect(onToggleFolderSelection).toHaveBeenCalledWith("src", folderFiles);
    expect(onDiscardTrackedFolder).toHaveBeenCalledWith("src", folderFiles);
    expect(onCloseContextMenu).toHaveBeenCalledTimes(2);
  });

  it("trashes untracked folders", () => {
    const onTrashUntrackedFolder = vi.fn();

    render(
      <ChangesExplorerFolderMenuItems
        folderPath="src"
        filesInFolder={folderFiles}
        isUntracked
        onCloseContextMenu={vi.fn()}
        onToggleFolderSelection={vi.fn()}
        onDiscardTrackedFolder={vi.fn()}
        onTrashUntrackedFolder={onTrashUntrackedFolder}
        getFolderCheckboxState={() => "checked"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trash Folder" }));

    expect(onTrashUntrackedFolder).toHaveBeenCalledWith("src", folderFiles);
  });

  it("does not expose normal folder actions for conflict-only folders", () => {
    render(
      <ChangesExplorerFolderMenuItems
        folderPath="src"
        filesInFolder={conflictedFolderFiles}
        isUntracked={false}
        onCloseContextMenu={vi.fn()}
        onToggleFolderSelection={vi.fn()}
        onDiscardTrackedFolder={vi.fn()}
        onTrashUntrackedFolder={vi.fn()}
        getFolderCheckboxState={() => "unchecked"}
      />,
    );

    expect(screen.getByRole("button", { name: "Resolve Conflicts" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Stage Folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard Changes" })).not.toBeInTheDocument();
  });
});
