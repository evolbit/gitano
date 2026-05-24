import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import ChangesExplorer from "./changes-explorer";

vi.mock("@/shared/api/git/staging", () => ({
  discardFileChanges: vi.fn(),
  stageAll: vi.fn(),
  stageFile: vi.fn(),
  stageLines: vi.fn(),
  trashUntrackedFile: vi.fn(),
  unstageAll: vi.fn(),
  unstageFile: vi.fn(),
}));

const files: ChangesExplorerFile[] = [
  { path: "src/alpha.ts", status: "modified", insertions: 1, deletions: 1 },
  { path: "src/beta.ts", status: "added", insertions: 2, deletions: 0 },
];

describe("ChangesExplorer", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters files in flat mode and selects a visible file", () => {
    const onSelectFile = vi.fn();

    render(
      <ChangesExplorer
        files={files}
        selectedPath={null}
        onSelectFile={onSelectFile}
        viewMode="flat"
        onViewModeChange={vi.fn()}
        showFileCheckboxes={false}
        surface="main"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search files..."), {
      target: { value: "beta" },
    });

    expect(screen.queryByText("alpha.ts")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("beta.ts"));

    expect(onSelectFile).toHaveBeenCalledWith(files[1]);
  });

  it("exposes main-surface view mode controls", () => {
    const onViewModeChange = vi.fn();

    render(
      <ChangesExplorer
        files={files}
        selectedPath={null}
        onSelectFile={vi.fn()}
        viewMode="flat"
        onViewModeChange={onViewModeChange}
        showFileCheckboxes={false}
        surface="main"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tree View" }));

    expect(onViewModeChange).toHaveBeenCalledWith("tree");
  });
});
