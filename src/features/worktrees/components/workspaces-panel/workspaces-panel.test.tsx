import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGitActionsStore } from "@/features/repository-workspace";
import { useRepoStore } from "@/features/repository-workspace";
import { useWorkspaceUiStore } from "@/features/repository-workspace";
import type { CommitListItem, GitWorktree } from "@/shared/types/git";
import { WorkspacesPanel } from "./workspaces-panel";

const getWorktreesMock = vi.hoisted(() => vi.fn());
const createGitWorktreeMock = vi.hoisted(() => vi.fn());
const removeGitWorktreeMock = vi.hoisted(() => vi.fn());
const getRepositoryStateMock = vi.hoisted(() => vi.fn());
const openDirectoryDialogMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/worktrees", () => ({
  getWorktrees: getWorktreesMock,
  createGitWorktree: createGitWorktreeMock,
  removeGitWorktree: removeGitWorktreeMock,
}));

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: getRepositoryStateMock,
}));

vi.mock("@/shared/platform/tauri/dialog", () => ({
  openDirectoryDialog: openDirectoryDialogMock,
}));

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

const selectedCommit: CommitListItem = {
  sha: "abc123",
  message: "Selected commit",
  author: "Test User",
  author_initial: "T",
  date: 1,
  current_branch: "main",
  source_branch: "main",
  commit_history: [],
  files: 1,
};

const worktrees: GitWorktree[] = [
  {
    path: "/repo",
    name: "repo",
    branch: "main",
    head: "abc123",
    isCurrent: true,
    isMain: true,
    isBare: false,
    isDetached: false,
  },
  {
    path: "/repo-feature",
    name: "feature-a",
    branch: "feature/a",
    head: "def456",
    isCurrent: false,
    isMain: false,
    isBare: false,
    isDetached: false,
  },
];

function renderPanel() {
  return render(
    <MantineProvider>
      <WorkspacesPanel repoPath="/repo" />
    </MantineProvider>,
  );
}

function getWorktreeRow(name: string) {
  const row = screen.getByText(name).closest("li");
  if (!row) throw new Error(`Missing row for ${name}`);
  return row;
}

describe("WorkspacesPanel", () => {
  beforeEach(() => {
    getWorktreesMock.mockReset();
    createGitWorktreeMock.mockReset();
    removeGitWorktreeMock.mockReset();
    getRepositoryStateMock.mockReset();
    openDirectoryDialogMock.mockReset();
    getWorktreesMock.mockResolvedValue(worktrees);
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    useRepoStore.setState({
      tabs: [
        {
          id: "repo-1",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit,
        },
      ],
      activeTabId: "repo-1",
      recentRepos: [],
      favoriteRepos: [],
    });
    useWorkspaceUiStore.setState({
      repoStateByPath: {},
    });
    useGitActionsStore.setState({
      pendingAction: null,
      notice: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("moves row selection without switching worktrees on a single row click", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("feature-a");
    const mainRow = getWorktreeRow("main worktree");
    const featureRow = getWorktreeRow("feature-a");

    await user.click(featureRow);

    expect(featureRow).toHaveClass("ring-blue-400");
    expect(mainRow).not.toHaveClass("ring-blue-400");
    expect(useRepoStore.getState().tabs[0]).toMatchObject({
      repoPath: "/repo",
      selectedBranch: "main",
      selectedCommit,
    });
    expect(useRepoStore.getState().recentRepos).toEqual([]);
  });

  it("switches worktrees on row double-click", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("feature-a");
    const featureRow = getWorktreeRow("feature-a");

    await user.dblClick(featureRow);

    await waitFor(() => {
      expect(useRepoStore.getState().tabs[0]).toMatchObject({
        repoPath: "/repo-feature",
        selectedBranch: "feature/a",
        selectedCommit: null,
      });
    });
    expect(useRepoStore.getState().recentRepos[0]).toBe("/repo-feature");
  });

  it("switches worktrees from the Use Worktree context-menu action", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("feature-a");
    const featureRow = getWorktreeRow("feature-a");
    await user.click(within(featureRow).getByTitle("More actions"));
    expect(featureRow).toHaveClass("ring-blue-400");
    await user.click(await screen.findByText("Use Worktree"));

    await waitFor(() => {
      expect(useRepoStore.getState().tabs[0]).toMatchObject({
        repoPath: "/repo-feature",
        selectedBranch: "feature/a",
        selectedCommit: null,
      });
    });
    expect(useRepoStore.getState().recentRepos[0]).toBe("/repo-feature");
    expect(screen.queryByText("Use Worktree")).not.toBeInTheDocument();
  });

  it("clears a stale selected branch for detached current worktrees", async () => {
    getWorktreesMock.mockResolvedValue([
      {
        path: "/repo",
        name: "ef7f",
        branch: null,
        head: "a557509c78608700fd2b1c616b2c658260048dc8",
        isCurrent: true,
        isMain: false,
        isBare: false,
        isDetached: true,
      },
    ]);
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: null,
      headStatus: "detached",
      hasCommits: true,
      isUnborn: false,
      isDetached: true,
    });
    useRepoStore.setState({
      tabs: [
        {
          id: "repo-1",
          repoPath: "/repo",
          selectedBranch: "codex/test-remote2",
          selectedCommit,
        },
      ],
      activeTabId: "repo-1",
    });

    renderPanel();

    expect(await screen.findByText(/Detached HEAD @ a557509/)).toBeInTheDocument();
    await waitFor(() => {
      expect(useRepoStore.getState().tabs[0]?.selectedBranch).toBeNull();
    });
  });

  it("disables Use Worktree for the current worktree without changing delete rules", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("main worktree");
    const mainRow = getWorktreeRow("main worktree");
    await user.click(within(mainRow).getByTitle("More actions"));

    expect(await screen.findByText("Use Worktree")).toHaveClass(
      "cursor-not-allowed",
    );
    expect(screen.getByText("Delete main worktree")).toHaveClass(
      "cursor-not-allowed",
    );
    expect(screen.getByText("Delete main worktree (forced)")).toHaveClass(
      "cursor-not-allowed",
    );
    expect(useRepoStore.getState().tabs[0]).toMatchObject({
      repoPath: "/repo",
      selectedBranch: "main",
      selectedCommit,
    });
  });
});
