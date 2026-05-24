import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace";
import type { CommitListItem, FileChange } from "@/shared/types/git";
import ChangesPanel from "./changes-panel";

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

const mocks = vi.hoisted(() => ({
  getCommitDiff: vi.fn(),
  amendCommitMessage: vi.fn(),
}));

vi.mock("@gfazioli/mantine-split-pane", () => {
  const Split = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Split.Pane = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Split.Resizer = () => <div data-testid="split-resizer" />;
  return { Split };
});

vi.mock("@/shared/api/git/commits", () => mocks);
vi.mock("@/features/working-changes", () => ({
  ChangesExplorer: ({ files, onSelectFile }: { files: FileChange[]; onSelectFile: (file: FileChange) => void }) => (
    <button type="button" onClick={() => onSelectFile(files[0])}>File {files[0]?.path}</button>
  ),
}));

const commit: CommitListItem = {
  sha: "abcdef123456",
  message: "Initial commit",
  author: "Ada",
  author_initial: "A",
  date: 0,
  current_branch: "main",
  source_branch: "main",
  commit_history: [],
  files: 1,
};

describe("ChangesPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useRepoStore.setState({ tabs: [], activeTabId: null });
  });

  it("prompts for a commit when no commit is selected", () => {
    render(<ChangesPanel />);

    expect(screen.getByText("Select a commit to view its changes")).toBeInTheDocument();
  });

  it("loads commit changes and reports selected files", async () => {
    const onSelectCommitFile = vi.fn();
    const change: FileChange = { path: "src/app.ts", status: "modified", insertions: 1, deletions: 0 };
    mocks.getCommitDiff.mockResolvedValueOnce({ commitSha: commit.sha, changes: [change] });
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: commit }],
    });

    render(<ChangesPanel onSelectCommitFile={onSelectCommitFile} />);

    await waitFor(() => expect(mocks.getCommitDiff).toHaveBeenCalledWith("/repo", commit.sha));
    fireEvent.click(await screen.findByRole("button", { name: "File src/app.ts" }));

    expect(onSelectCommitFile).toHaveBeenCalledWith(change);
  });
});
