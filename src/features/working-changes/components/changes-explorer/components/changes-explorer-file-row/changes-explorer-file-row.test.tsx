import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { ChangesExplorerFileRow } from "./changes-explorer-file-row";

const file: ChangesExplorerFile = {
  path: "src/features/example.ts",
  status: "modified",
  insertions: 12,
  deletions: 3,
};

function renderFileRow(
  alignCountColumnWithHeaderActions = false,
  commentCount = 0,
  rowFile: ChangesExplorerFile = file,
) {
  return render(
    <ChangesExplorerFileRow
      file={rowFile}
      selectedPath={null}
      showFileCheckboxes
      checkboxState="unchecked"
      onSelectFile={vi.fn()}
      onOpenFileContextMenu={vi.fn()}
      onToggleFileSelection={vi.fn()}
      alignCountColumnWithHeaderActions={alignCountColumnWithHeaderActions}
      commentCount={commentCount}
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

  it("shows a PR comment marker before the change counts", () => {
    renderFileRow(false, 2);

    expect(screen.getByLabelText("2 PR comments")).toBeInTheDocument();
    const countColumn = screen.getByText("+12").parentElement;

    expect(countColumn?.textContent).toContain("+12");
    expect(countColumn?.textContent).toContain("-3");
  });

  it("shows conflict metadata without normal staging checkbox", () => {
    renderFileRow(false, 0, {
      ...file,
      status: ChangeType.Conflicted,
      insertions: 0,
      deletions: 0,
      conflictCount: 1,
    });

    expect(screen.getByText("1 conflict")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Toggle file selection" }),
    ).not.toBeInTheDocument();
  });
});
