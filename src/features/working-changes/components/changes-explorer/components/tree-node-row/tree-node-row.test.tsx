import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangesExplorerTreeNode } from "@/shared/lib/tree/changes-explorer-tree";
import { TreeNodeRow } from "./tree-node-row";

const fileNode: ChangesExplorerTreeNode = {
  kind: "file",
  path: "src/app.ts",
  name: "app.ts",
  file: { path: "src/app.ts", status: "modified", insertions: 3, deletions: 1 },
};

const folderNode: ChangesExplorerTreeNode = {
  kind: "folder",
  path: "src",
  name: "src",
  children: [fileNode],
};

function renderRow(node: ChangesExplorerTreeNode, overrides = {}) {
  const props = {
    sectionName: "Tracked",
    node,
    depth: 0,
    search: "",
    expanded: {},
    selectedPath: null,
    showFileCheckboxes: true,
    getFileCheckboxState: vi.fn().mockReturnValue("unchecked"),
    onSelectFile: vi.fn(),
    onOpenFileContextMenu: vi.fn(),
    onOpenFolderContextMenu: vi.fn(),
    onToggleFolder: vi.fn(),
    onToggleFileSelection: vi.fn(),
    onToggleFolderSelection: vi.fn(),
    getFolderCheckboxState: vi.fn().mockReturnValue("unchecked"),
    ...overrides,
  };

  render(<TreeNodeRow {...props} />);
  return props;
}

describe("TreeNodeRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("selects files, opens file context menus, and toggles file selection", () => {
    const props = renderRow(fileNode);

    fireEvent.click(screen.getByText("app.ts"));
    fireEvent.contextMenu(screen.getByText("app.ts"));
    fireEvent.click(screen.getAllByRole("button", { name: "Toggle file selection" })[0]);

    expect(props.onSelectFile).toHaveBeenCalledWith(fileNode.file);
    expect(props.onOpenFileContextMenu).toHaveBeenCalledWith(
      fileNode.file,
      expect.any(Number),
      expect.any(Number),
    );
    expect(props.onToggleFileSelection).toHaveBeenCalledWith(fileNode.file);
  });

  it("toggles folders and folder selection", () => {
    const props = renderRow(folderNode);

    fireEvent.click(screen.getByText("src"));
    fireEvent.click(screen.getAllByRole("button", { name: "Toggle file selection" })[0]);

    expect(props.onToggleFolder).toHaveBeenCalledWith("Tracked:src");
    expect(props.onToggleFolderSelection).toHaveBeenCalledWith("src", [fileNode.file]);
  });

  it("shows a PR comment marker before file change counts", () => {
    renderRow(fileNode, { fileCommentCounts: { "src/app.ts": 1 } });

    expect(screen.getByLabelText("1 PR comment")).toBeInTheDocument();
  });
});
