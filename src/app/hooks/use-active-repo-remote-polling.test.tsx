import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_REPO_REMOTE_POLL_INITIAL_DELAY_MS,
  useActiveRepoRemotePolling,
} from "./use-active-repo-remote-polling";
import { useGitActionsStore, useRepoStore } from "@/features/repository-workspace";
import { useWorkspaceUiStore } from "@/features/repository-workspace/stores/workspace-ui-store";
import { APP_EVENTS } from "@/shared/config/events";

const fetchAllRemotesMock = vi.hoisted(() => vi.fn());
const hasRemoteRefUpdatesMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/sync", () => ({
  fetchAllRemotes: fetchAllRemotesMock,
  hasRemoteRefUpdates: hasRemoteRefUpdatesMock,
}));

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

function ActiveRepoRemotePollingHarness() {
  useActiveRepoRemotePolling();
  return null;
}

describe("useActiveRepoRemotePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchAllRemotesMock.mockReset();
    fetchAllRemotesMock.mockResolvedValue(undefined);
    hasRemoteRefUpdatesMock.mockReset();
    hasRemoteRefUpdatesMock.mockResolvedValue(false);
    useGitActionsStore.setState({ pendingAction: null, notice: null });
    useWorkspaceUiStore.setState({
      pullStrategy: "pull-ff-if-possible",
      pushMode: "push-branch",
      repoStateByPath: {},
    });
    useRepoStore.setState({
      tabs: [],
      activeTabId: null,
      recentRepos: [],
      favoriteRepos: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fetches and refreshes when the active repo remote refs changed", async () => {
    hasRemoteRefUpdatesMock.mockResolvedValueOnce(true);
    const repoRefsRefresh = vi.fn();
    const commitsRefresh = vi.fn();
    window.addEventListener(APP_EVENTS.repoRefsRefresh, repoRefsRefresh);
    window.addEventListener(APP_EVENTS.commitsRefresh, commitsRefresh);
    useRepoStore.setState({
      tabs: [
        {
          id: "repo",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo",
      recentRepos: [],
      favoriteRepos: [],
    });

    render(<ActiveRepoRemotePollingHarness />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVE_REPO_REMOTE_POLL_INITIAL_DELAY_MS);
    });

    expect(hasRemoteRefUpdatesMock).toHaveBeenCalledWith("/repo");
    expect(fetchAllRemotesMock).toHaveBeenCalledWith("/repo", "fetch-all");
    expect(repoRefsRefresh).toHaveBeenCalledOnce();
    expect(commitsRefresh).toHaveBeenCalledOnce();

    window.removeEventListener(APP_EVENTS.repoRefsRefresh, repoRefsRefresh);
    window.removeEventListener(APP_EVENTS.commitsRefresh, commitsRefresh);
  });

  it("uses prune fetch mode when the toolbar preference is fetch all with prune", async () => {
    hasRemoteRefUpdatesMock.mockResolvedValueOnce(true);
    useWorkspaceUiStore.setState({
      pullStrategy: "fetch-all-prune",
      pushMode: "push-branch",
      repoStateByPath: {},
    });
    useRepoStore.setState({
      tabs: [
        {
          id: "repo",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo",
      recentRepos: [],
      favoriteRepos: [],
    });

    render(<ActiveRepoRemotePollingHarness />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVE_REPO_REMOTE_POLL_INITIAL_DELAY_MS);
    });

    expect(fetchAllRemotesMock).toHaveBeenCalledWith(
      "/repo",
      "fetch-all-prune",
    );
  });

  it("stops polling the previous repo when the active tab changes", async () => {
    useRepoStore.setState({
      tabs: [
        {
          id: "repo-a",
          repoPath: "/repo-a",
          selectedBranch: "main",
          selectedCommit: null,
        },
        {
          id: "repo-b",
          repoPath: "/repo-b",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo-a",
      recentRepos: [],
      favoriteRepos: [],
    });

    render(<ActiveRepoRemotePollingHarness />);
    act(() => {
      useRepoStore.setState({ activeTabId: "repo-b" });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVE_REPO_REMOTE_POLL_INITIAL_DELAY_MS);
    });

    expect(hasRemoteRefUpdatesMock).toHaveBeenCalledWith("/repo-b");
    expect(hasRemoteRefUpdatesMock).not.toHaveBeenCalledWith("/repo-a");
  });

  it("does not poll while another Git action is pending", async () => {
    useGitActionsStore.setState({ pendingAction: "push" });
    useRepoStore.setState({
      tabs: [
        {
          id: "repo",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo",
      recentRepos: [],
      favoriteRepos: [],
    });

    render(<ActiveRepoRemotePollingHarness />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVE_REPO_REMOTE_POLL_INITIAL_DELAY_MS);
    });

    expect(hasRemoteRefUpdatesMock).not.toHaveBeenCalled();
    expect(fetchAllRemotesMock).not.toHaveBeenCalled();
  });
});
