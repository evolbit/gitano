import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import { ChangeType } from "@/shared/types/git";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import ChangesExplorer from "./changes-explorer";

const stageFilesMock = vi.hoisted(() => vi.fn());
const unstageFilesMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/staging", () => ({
  discardFileChanges: vi.fn(),
  stageAll: vi.fn(),
  stageFile: vi.fn(),
  stageFiles: stageFilesMock,
  stageLines: vi.fn(),
  trashUntrackedFile: vi.fn(),
  unstageAll: vi.fn(),
  unstageFile: vi.fn(),
  unstageFiles: unstageFilesMock,
}));

const files: ChangesExplorerFile[] = [
  { path: "src/alpha.ts", status: "modified", insertions: 1, deletions: 1 },
  { path: "src/beta.ts", status: "added", insertions: 2, deletions: 0 },
];

const conflictedFile = {
  path: "src/conflict.ts",
  status: ChangeType.Conflicted,
  insertions: 0,
  deletions: 0,
  conflictCount: 1,
};

const untrackedFile: ChangesExplorerFile = {
  ...files[1],
  isUntracked: true,
  fileSignature: "src/beta.ts:added",
};

describe("ChangesExplorer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useStagedLinesStore.getState().clearAllStagedLines();
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

  it("stages folder files through the batch adapter", async () => {
    stageFilesMock.mockResolvedValueOnce(undefined);

    render(
      <ChangesExplorer
        files={files}
        selectedPath={null}
        onSelectFile={vi.fn()}
        viewMode="tree"
        onViewModeChange={vi.fn()}
        showFileCheckboxes
        surface="main"
        repoPath="/repo"
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Toggle file selection" })[0],
    );

    await waitFor(() => {
      expect(stageFilesMock).toHaveBeenCalledWith("/repo", [
        "src/alpha.ts",
        "src/beta.ts",
      ]);
    });
  });

  it("renders conflict rows before tracked and untracked rows in flat mode", () => {
    const onSelectFile = vi.fn();

    render(
      <ChangesExplorer
        files={[files[0], conflictedFile, untrackedFile]}
        selectedPath={null}
        onSelectFile={onSelectFile}
        viewMode="flat"
        onViewModeChange={vi.fn()}
        showFileCheckboxes
        surface="main"
      />,
    );

    const conflictsHeader = screen.getByText("Conflicts");
    const trackedHeader = screen.getByText("Tracked");
    const untrackedHeader = screen.getByText("Untracked");

    expect(
      conflictsHeader.compareDocumentPosition(trackedHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      trackedHeader.compareDocumentPosition(untrackedHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Conflict")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Toggle file selection" }),
    ).toHaveLength(2);

    fireEvent.click(screen.getByText("conflict.ts"));

    expect(onSelectFile).toHaveBeenCalledWith(conflictedFile);
  });

  it("filters conflict rows with the existing search input", () => {
    render(
      <ChangesExplorer
        files={[files[0], conflictedFile]}
        selectedPath={null}
        onSelectFile={vi.fn()}
        viewMode="flat"
        onViewModeChange={vi.fn()}
        showFileCheckboxes={false}
        surface="main"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search files..."), {
      target: { value: "conflict" },
    });

    expect(screen.getByText("conflict.ts")).toBeInTheDocument();
    expect(screen.queryByText("alpha.ts")).not.toBeInTheDocument();
  });

  it("renders conflict rows in a tree section", () => {
    const onSelectFile = vi.fn();

    render(
      <ChangesExplorer
        files={[files[0], conflictedFile]}
        selectedPath={null}
        onSelectFile={onSelectFile}
        viewMode="tree"
        onViewModeChange={vi.fn()}
        showFileCheckboxes
        surface="main"
      />,
    );

    expect(screen.getByText("Conflicts")).toBeInTheDocument();
    expect(screen.getByText("conflict.ts")).toBeInTheDocument();
    expect(screen.getByText("Conflict")).toBeInTheDocument();

    fireEvent.click(screen.getByText("conflict.ts"));

    expect(onSelectFile).toHaveBeenCalledWith(conflictedFile);
  });

  it("skips conflict rows when staging all visible files", async () => {
    stageFilesMock.mockResolvedValueOnce(undefined);

    render(
      <ChangesExplorer
        files={[files[0], conflictedFile]}
        selectedPath={null}
        onSelectFile={vi.fn()}
        viewMode="flat"
        onViewModeChange={vi.fn()}
        showHeader
        showFileCheckboxes
        surface="main"
        repoPath="/repo"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stage All" }));

    await waitFor(() => {
      expect(stageFilesMock).toHaveBeenCalledWith("/repo", ["src/alpha.ts"]);
    });
  });

  it("restores optimistic folder state when batch staging fails", async () => {
    stageFilesMock.mockRejectedValueOnce(new Error("stage failed"));

    render(
      <ChangesExplorer
        files={files}
        selectedPath={null}
        onSelectFile={vi.fn()}
        viewMode="tree"
        onViewModeChange={vi.fn()}
        showFileCheckboxes
        surface="main"
        repoPath="/repo"
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Toggle file selection" })[0],
    );

    expect(await screen.findByText("Error: stage failed")).toBeInTheDocument();
    expect(useStagedLinesStore.getState().stagedLines).toEqual({});
  });
});
