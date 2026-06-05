import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { ChangesExplorerFileMenuItems } from "./changes-explorer-menu-file-items";

const trackedFile: ChangesExplorerFile = {
  path: "src/app.ts",
  status: "modified",
  insertions: 2,
  deletions: 1,
};

const untrackedFile: ChangesExplorerFile = {
  path: "src/new.ts",
  status: "added",
  insertions: 1,
  deletions: 0,
  hunks: [],
};

const conflictedFile: ChangesExplorerFile = {
  path: "src/conflict.ts",
  status: ChangeType.Conflicted,
  insertions: 0,
  deletions: 0,
};

describe("ChangesExplorerFileMenuItems", () => {
  afterEach(() => {
    cleanup();
  });

  it("toggles checked tracked files and discards tracked changes", () => {
    const onCloseContextMenu = vi.fn();
    const onToggleFileSelection = vi.fn();
    const onDiscardTrackedFile = vi.fn();

    render(
      <ChangesExplorerFileMenuItems
        file={trackedFile}
        onCloseContextMenu={onCloseContextMenu}
        onToggleFileSelection={onToggleFileSelection}
        onDiscardTrackedFile={onDiscardTrackedFile}
        onTrashUntrackedFile={vi.fn()}
        getCheckboxState={() => "checked"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unstage File" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard Changes" }));

    expect(onToggleFileSelection).toHaveBeenCalledWith(trackedFile);
    expect(onDiscardTrackedFile).toHaveBeenCalledWith(trackedFile);
    expect(onCloseContextMenu).toHaveBeenCalledTimes(2);
  });

  it("trashes untracked files instead of discarding tracked changes", () => {
    const onTrashUntrackedFile = vi.fn();

    render(
      <ChangesExplorerFileMenuItems
        file={untrackedFile}
        onCloseContextMenu={vi.fn()}
        onToggleFileSelection={vi.fn()}
        onDiscardTrackedFile={vi.fn()}
        onTrashUntrackedFile={onTrashUntrackedFile}
        getCheckboxState={() => "unchecked"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trash File" }));

    expect(onTrashUntrackedFile).toHaveBeenCalledWith(untrackedFile);
    expect(screen.queryByRole("button", { name: "View File Blame" })).not.toBeInTheDocument();
  });

  it("does not expose normal file actions for conflicted files", () => {
    render(
      <ChangesExplorerFileMenuItems
        file={conflictedFile}
        onCloseContextMenu={vi.fn()}
        onToggleFileSelection={vi.fn()}
        onDiscardTrackedFile={vi.fn()}
        onTrashUntrackedFile={vi.fn()}
        getCheckboxState={() => "unchecked"}
      />,
    );

    expect(screen.getByRole("button", { name: "Resolve Conflict" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Stage File" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard Changes" })).not.toBeInTheDocument();
  });
});
