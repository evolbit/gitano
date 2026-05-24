import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { ChangesExplorerMenu } from "./changes-explorer-menu";

const file: ChangesExplorerFile = {
  path: "src/app.ts",
  status: "modified",
  insertions: 1,
  deletions: 1,
};

describe("ChangesExplorerMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("switches view mode from the pane context menu", () => {
    const onViewModeChange = vi.fn();
    const onCloseContextMenu = vi.fn();

    render(
      <ChangesExplorerMenu
        activeContextMenu={{ kind: "pane" }}
        menuPos={{ x: 4, y: 8 }}
        menuRef={createRef<HTMLDivElement>()}
        surface="main"
        viewMode="flat"
        onViewModeChange={onViewModeChange}
        onCloseContextMenu={onCloseContextMenu}
        onToggleFileSelection={vi.fn()}
        onToggleFolderSelection={vi.fn()}
        onDiscardTrackedFile={vi.fn()}
        onDiscardTrackedFolder={vi.fn()}
        onTrashUntrackedFile={vi.fn()}
        onTrashUntrackedFolder={vi.fn()}
        getCheckboxState={vi.fn().mockReturnValue("unchecked")}
        getFolderCheckboxState={vi.fn().mockReturnValue("unchecked")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tree View" }));

    expect(onViewModeChange).toHaveBeenCalledWith("tree");
    expect(onCloseContextMenu).toHaveBeenCalledOnce();
  });

  it("routes file menu actions to file callbacks", () => {
    const onToggleFileSelection = vi.fn();

    render(
      <ChangesExplorerMenu
        activeContextMenu={{ kind: "file", file }}
        menuPos={{ x: 4, y: 8 }}
        menuRef={createRef<HTMLDivElement>()}
        surface="main"
        viewMode="tree"
        onViewModeChange={vi.fn()}
        onCloseContextMenu={vi.fn()}
        onToggleFileSelection={onToggleFileSelection}
        onToggleFolderSelection={vi.fn()}
        onDiscardTrackedFile={vi.fn()}
        onDiscardTrackedFolder={vi.fn()}
        onTrashUntrackedFile={vi.fn()}
        onTrashUntrackedFolder={vi.fn()}
        getCheckboxState={vi.fn().mockReturnValue("unchecked")}
        getFolderCheckboxState={vi.fn().mockReturnValue("unchecked")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stage File" }));

    expect(onToggleFileSelection).toHaveBeenCalledWith(file);
  });
});
