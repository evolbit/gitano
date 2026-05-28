import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import { useWorkspaceUiStore } from "@/features/repository-workspace/stores/workspace-ui-store";
import TopToolbar from "./top-toolbar";

const fetchAllRemotesMock = vi.hoisted(() => vi.fn());
const pushRepositoryMock = vi.hoisted(() => vi.fn());
const integrationApiMocks = vi.hoisted(() => ({
  getProviderRepositoryMergeOptions: vi.fn(),
  getProviderPullRequestCount: vi.fn(),
  listProviderIntegrations: vi.fn(),
  listProviderPullRequests: vi.fn(),
}));

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

vi.mock("@/shared/api/integrations", () => integrationApiMocks);

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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <TopToolbar />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe("TopToolbar", () => {
  beforeEach(() => {
    fetchAllRemotesMock.mockReset();
    fetchAllRemotesMock.mockResolvedValue(undefined);
    pushRepositoryMock.mockReset();
    pushRepositoryMock.mockResolvedValue(undefined);
    integrationApiMocks.getProviderPullRequestCount.mockReset();
    integrationApiMocks.getProviderPullRequestCount.mockResolvedValue({
      repository: { owner: "acme", name: "app" },
      count: 0,
    });
    integrationApiMocks.getProviderRepositoryMergeOptions.mockReset();
    integrationApiMocks.getProviderRepositoryMergeOptions.mockResolvedValue({
      mergeCommit: true,
      squash: true,
      rebase: true,
    });
    integrationApiMocks.listProviderIntegrations.mockReset();
    integrationApiMocks.listProviderIntegrations.mockResolvedValue([
      {
        id: "github",
        displayName: "GitHub",
        capabilities: ["pullRequests", "pullRequestReviews"],
        status: "connected",
        connection: { accountLogin: "reviewer", avatarUrl: null, scopes: [] },
        lastError: null,
        selectedAccessMethod: "autoFallback",
        oauth: null,
        ghCli: null,
      },
    ]);
    integrationApiMocks.listProviderPullRequests.mockReset();
    integrationApiMocks.listProviderPullRequests.mockResolvedValue([]);
    useRepoStore.setState({ tabs: [], activeTabId: null });
    useGitActionsStore.setState({ pendingAction: null, notice: null });
    useWorkspaceUiStore.setState({
      pullStrategy: "pull-ff-if-possible",
      pushMode: "push-branch",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty workspace labels and disables repository actions without an active repo", () => {
    renderToolbar();

    expect(screen.getByText("No workspace")).toBeInTheDocument();
    expect(screen.getByText("No branch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Push" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stash" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pop" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PRs" })).toBeDisabled();
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

  it("shows the pending pull request count for the active repository", async () => {
    integrationApiMocks.getProviderPullRequestCount.mockResolvedValueOnce({
      repository: { owner: "acme", name: "app" },
      count: 3,
    });
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

    expect(await screen.findByRole("button", { name: "PRs (3)" })).toBeEnabled();
    expect(integrationApiMocks.getProviderPullRequestCount).toHaveBeenCalledWith({
      providerId: "github",
      path: "/repo",
    });
  });

  it("opens pull requests even when count refresh is unavailable", async () => {
    integrationApiMocks.getProviderPullRequestCount.mockRejectedValueOnce(
      new Error("GitHub is not connected"),
    );
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

    fireEvent.click(await screen.findByRole("button", { name: /^PRs/ }));

    expect(await screen.findByRole("dialog", { name: "Pull requests" })).toBeInTheDocument();
  });

  it("requests counts directly and leaves pull requests available when count fails", async () => {
    integrationApiMocks.getProviderPullRequestCount.mockRejectedValueOnce(
      new Error("GitHub is not connected"),
    );
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

    await waitFor(() => {
      expect(integrationApiMocks.getProviderPullRequestCount).toHaveBeenCalledWith({
        providerId: "github",
        path: "/repo",
      });
    });
    expect(screen.getByRole("button", { name: /^PRs/ })).toBeEnabled();
  });
});
