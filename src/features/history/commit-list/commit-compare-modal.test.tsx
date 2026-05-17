import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommitListItem, FileChange } from "@/shared/types/git";
import { CommitCompareModal } from "./commit-compare-modal";

const getCommitDiffMock = vi.hoisted(() => vi.fn());
const getCommitFileDiffMock = vi.hoisted(() => vi.fn());
const getCommitWorktreeComparisonFilesMock = vi.hoisted(() => vi.fn());
const getCommitWorktreeComparisonFileDiffMock = vi.hoisted(() => vi.fn());

vi.mock("@gfazioli/mantine-split-pane", () => {
  function Split({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  Split.Pane = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  Split.Resizer = () => <div />;

  return { Split };
});

vi.mock("@/features/diffs", () => ({
  DiffViewerBase: ({ filePath }: { filePath: string }) => (
    <div>Diff for {filePath}</div>
  ),
}));

vi.mock("@/features/working-changes/changes-explorer/changes-explorer", () => ({
  default: ({
    files,
    emptyStateMessage,
  }: {
    files: FileChange[];
    emptyStateMessage: string;
  }) => (
    <div>
      {files.length
        ? files.map((file) => <div key={file.path}>{file.path}</div>)
        : emptyStateMessage}
    </div>
  ),
}));

vi.mock("@/shared/api/git/commits", () => ({
  getCommitDiff: getCommitDiffMock,
}));

vi.mock("@/shared/api/git/diffs", () => ({
  getCommitFileDiff: getCommitFileDiffMock,
  getCommitWorktreeComparisonFiles: getCommitWorktreeComparisonFilesMock,
  getCommitWorktreeComparisonFileDiff: getCommitWorktreeComparisonFileDiffMock,
}));

const fileChange: FileChange = {
  path: "src/app.ts",
  status: "modified",
  insertions: 1,
  deletions: 1,
};

function commit(overrides: Partial<CommitListItem> = {}): CommitListItem {
  return {
    sha: "abc123456789",
    parents: ["def456789012"],
    refs: [],
    message: "Add compare modal",
    author: "Test User",
    author_initial: "T",
    date: 1,
    current_branch: "main",
    source_branch: "main",
    commit_history: [],
    files: 1,
    ...overrides,
  };
}

describe("CommitCompareModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads parent comparison data through commit diff APIs", async () => {
    getCommitDiffMock.mockResolvedValue({
      commitSha: "abc123456789",
      changes: [fileChange],
    });
    getCommitFileDiffMock.mockResolvedValue([]);

    render(
      <CommitCompareModal
        repoPath="/repo"
        commit={commit()}
        mode="parent"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Compare with parent")).toBeInTheDocument();
    expect(screen.getByText("def4567")).toBeInTheDocument();

    await waitFor(() => {
      expect(getCommitDiffMock).toHaveBeenCalledWith("/repo", "abc123456789");
      expect(getCommitFileDiffMock).toHaveBeenCalledWith({
        path: "/repo",
        sha: "abc123456789",
        filePath: "src/app.ts",
        context: 3,
      });
    });
    expect(getCommitWorktreeComparisonFilesMock).not.toHaveBeenCalled();
  });

  it("loads working-tree comparison data through commit worktree APIs", async () => {
    getCommitWorktreeComparisonFilesMock.mockResolvedValue([fileChange]);
    getCommitWorktreeComparisonFileDiffMock.mockResolvedValue([]);

    render(
      <CommitCompareModal
        repoPath="/repo"
        commit={commit()}
        mode="workingTree"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Compare with working tree")).toBeInTheDocument();
    expect(screen.getByText("working tree")).toBeInTheDocument();

    await waitFor(() => {
      expect(getCommitWorktreeComparisonFilesMock).toHaveBeenCalledWith({
        path: "/repo",
        baseRef: "abc123456789",
      });
      expect(getCommitWorktreeComparisonFileDiffMock).toHaveBeenCalledWith({
        path: "/repo",
        baseRef: "abc123456789",
        filePath: "src/app.ts",
        context: 3,
      });
    });
    expect(getCommitDiffMock).not.toHaveBeenCalled();
  });
});
