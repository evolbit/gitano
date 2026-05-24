import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { ChangesExplorerFileRow } from "./changes-explorer-file-row";

const file: ChangesExplorerFile = {
  path: "src/features/example.ts",
  status: "modified",
  insertions: 12,
  deletions: 3,
};

function renderFileRow(alignCountColumnWithHeaderActions = false) {
  return render(
    <ChangesExplorerFileRow
      file={file}
      selectedPath={null}
      showFileCheckboxes
      checkboxState="unchecked"
      onSelectFile={vi.fn()}
      onOpenFileContextMenu={vi.fn()}
      onToggleFileSelection={vi.fn()}
      alignCountColumnWithHeaderActions={alignCountColumnWithHeaderActions}
    />,
  );
}

describe("ChangesExplorerFileRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("adds scoped right padding when aligning counts with header actions", () => {
    renderFileRow(true);

    const countColumn = screen.getByText("+12").parentElement;

    expect(countColumn?.className).toContain("w-[4.5rem]");
    expect(countColumn?.className).toContain("pr-2");
    expect(
      screen.getByRole("button", { name: "Toggle file selection" }),
    ).toBeInTheDocument();
  });

  it("keeps the compact count column by default", () => {
    renderFileRow();

    const countColumn = screen.getByText("+12").parentElement;

    expect(countColumn?.className).toContain("w-14");
    expect(countColumn?.className).not.toContain("pr-2");
  });

  it("keeps the filename untruncated and truncates the parent path from the start", () => {
    renderFileRow();

    expect(screen.getByText("example.ts").className).toContain("shrink-0");
    const parentPath = screen.getByText("src/features");

    expect(parentPath.className).toContain("truncate");
    expect(parentPath.className).toContain("[direction:rtl]");
  });
});
