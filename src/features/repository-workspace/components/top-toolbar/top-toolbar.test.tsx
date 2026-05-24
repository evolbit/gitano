import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import { useWorkspaceUiStore } from "@/features/repository-workspace/stores/workspace-ui-store";
import TopToolbar from "./top-toolbar";

const fetchAllRemotesMock = vi.hoisted(() => vi.fn());
const pushRepositoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/shared/api/git/branches", () => ({
  getBranches: vi.fn().mockResolvedValue([]),
  getCurrentBranch: vi.fn().mockResolvedValue("main"),
  getWorktrees: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/shared/api/git/sync", () => ({
  fetchAllRemotes: fetchAllRemotesMock,
  pullRepository: vi.fn().mockResolvedValue(undefined),
  pushRepository: pushRepositoryMock,
}));

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: vi.fn().mockResolvedValue({
    path: "/repo",
    isValid: true,
    branch: null,
    headStatus: "unknown",
    hasCommits: true,
    isUnborn: false,
    isDetached: false,
  }),
}));

function renderToolbar() {
  return render(
    <MantineProvider>
      <TopToolbar />
    </MantineProvider>,
  );
}

describe("TopToolbar", () => {
  afterEach(() => {
    cleanup();
    fetchAllRemotesMock.mockReset();
    fetchAllRemotesMock.mockResolvedValue(undefined);
    pushRepositoryMock.mockReset();
    pushRepositoryMock.mockResolvedValue(undefined);
    useRepoStore.setState({ tabs: [], activeTabId: null });
    useGitActionsStore.setState({ pendingAction: null, notice: null });
    useWorkspaceUiStore.setState({
      pullStrategy: "pull-ff-if-possible",
      pushMode: "push-branch",
    });
  });

  it("shows empty workspace labels and disables repository actions without an active repo", () => {
    renderToolbar();

    expect(screen.getByText("No workspace")).toBeInTheDocument();
    expect(screen.getByText("No branch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Push" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stash" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pop" })).toBeDisabled();
  });

  it("persists the selected push mode and uses it for toolbar push", async () => {
    useRepoStore.setState({
      tabs: [
        {
          id: "tab-1",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "tab-1",
    });

    renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "Select push mode" }));
    fireEvent.click(await screen.findByText("Push current branch with tags"));

    expect(useWorkspaceUiStore.getState().pushMode).toBe("push-branch-and-tags");

    fireEvent.click(screen.getByRole("button", { name: "Push" }));

    await waitFor(() => {
      expect(pushRepositoryMock).toHaveBeenCalledWith(
        "/repo",
        "push-branch-and-tags",
      );
    });
  });

  it("persists the prune fetch mode and uses it for toolbar fetch", async () => {
    useRepoStore.setState({
      tabs: [
        {
          id: "tab-1",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "tab-1",
    });

    renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "Select pull strategy" }));
    fireEvent.click(await screen.findByText("Fetch All + Tags + Prune"));

    expect(useWorkspaceUiStore.getState().pullStrategy).toBe("fetch-all-prune");

    fireEvent.click(screen.getByRole("button", { name: "Pull" }));

    await waitFor(() => {
      expect(fetchAllRemotesMock).toHaveBeenCalledWith(
        "/repo",
        "fetch-all-prune",
      );
    });
  });
});
