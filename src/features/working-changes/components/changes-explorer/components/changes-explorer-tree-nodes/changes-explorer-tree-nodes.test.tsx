import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangesExplorerTreeNode } from "@/shared/lib/tree/changes-explorer-tree";
import { ChangesExplorerTreeNodes } from "./changes-explorer-tree-nodes";

const nodes: ChangesExplorerTreeNode[] = [
  {
    kind: "file",
    path: "src/app.ts",
    name: "app.ts",
    file: { path: "src/app.ts", status: "modified", insertions: 1, deletions: 0 },
  },
];

describe("ChangesExplorerTreeNodes", () => {
  afterEach(() => {
    cleanup();
  });

  it("delegates file selection from rendered tree rows", () => {
    const onSelectFile = vi.fn();

    render(
      <ChangesExplorerTreeNodes
        nodes={nodes}
        depth={0}
        search=""
        expanded={{}}
        selectedPath={null}
        showFileCheckboxes={false}
        getFileCheckboxState={vi.fn().mockReturnValue("unchecked")}
        onSelectFile={onSelectFile}
        onOpenFileContextMenu={vi.fn()}
        onOpenFolderContextMenu={vi.fn()}
        onToggleFolder={vi.fn()}
        onToggleFileSelection={vi.fn()}
        onToggleFolderSelection={vi.fn()}
        getFolderCheckboxState={vi.fn().mockReturnValue("unchecked")}
      />,
    );

    fireEvent.click(screen.getByText("app.ts"));

    expect(onSelectFile).toHaveBeenCalledWith(nodes[0].kind === "file" ? nodes[0].file : undefined);
  });
});
