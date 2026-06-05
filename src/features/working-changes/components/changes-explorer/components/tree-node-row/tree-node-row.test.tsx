import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
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
  files: [fileNode.file],
};

const conflictFile = {
  path: "src/conflict.ts",
  status: ChangeType.Conflicted,
  insertions: 0,
  deletions: 0,
  conflictCount: 2,
};

const conflictFileNode: ChangesExplorerTreeNode = {
  kind: "file",
  path: "src/conflict.ts",
  name: "conflict.ts",
  file: conflictFile,
};

const conflictFolderNode: ChangesExplorerTreeNode = {
  kind: "folder",
  path: "src",
  name: "src",
  children: [conflictFileNode],
  files: [conflictFile],
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

  it("shows conflict metadata without a file checkbox", () => {
    renderRow(conflictFileNode);

    expect(screen.getByText("2 conflicts")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Toggle file selection" }),
    ).not.toBeInTheDocument();
  });

  it("omits folder checkbox for conflict-only folders", () => {
    renderRow(conflictFolderNode);

    expect(
      screen.queryByRole("button", { name: "Toggle file selection" }),
    ).not.toBeInTheDocument();
  });
});
