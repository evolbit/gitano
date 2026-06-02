import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { useWorkspaceUiStore } from "@/features/repository-workspace/stores/workspace-ui-store";
import { getRepositoryState } from "@/shared/api/repositories";
import { checkoutRemoteGitBranch, getCurrentBranch } from "../api";
import { useBranchListBehavior } from "./use-branch-list-behavior";

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: vi.fn(),
}));

vi.mock("@/shared/api/integrations", () => ({
  listProviderPullRequests: vi.fn().mockResolvedValue([]),
  prepareProviderPullRequestRefs: vi.fn(),
}));

vi.mock("@/shared/api/git/commits", () => ({
  getRemoteUrl: vi.fn().mockResolvedValue(null),
}));

vi.mock("../api", () => ({
  checkoutRemoteGitBranch: vi.fn(),
  checkoutGitBranch: vi.fn(),
  createGitBranch: vi.fn(),
  createGitWorktree: vi.fn(),
  deleteGitBranch: vi.fn(),
  deleteRemoteGitBranch: vi.fn(),
  getBranches: vi.fn().mockResolvedValue([]),
  getBranchRefs: vi.fn().mockResolvedValue([]),
  getBranchTipSha: vi.fn(),
  getCurrentBranch: vi.fn().mockResolvedValue("Detached HEAD"),
  getWorktrees: vi.fn().mockResolvedValue([]),
  renameGitBranch: vi.fn(),
  runGitBranchOperation: vi.fn(),
  runRemoteGitBranchOperation: vi.fn(),
  runRemoteBranchAction: vi.fn(),
}));

vi.mock("@/shared/platform/clipboard", () => ({
  writeClipboardText: vi.fn(),
  writeClipboardTextFromPromise: vi.fn(),
}));

vi.mock("@/shared/platform/tauri/opener", () => ({
  openExternalUrl: vi.fn(),
}));

const getRepositoryStateMock = vi.mocked(getRepositoryState);
const checkoutRemoteGitBranchMock = vi.mocked(checkoutRemoteGitBranch);
const getCurrentBranchMock = vi.mocked(getCurrentBranch);

describe("useBranchListBehavior", () => {
  beforeEach(() => {
    getRepositoryStateMock.mockReset();
    checkoutRemoteGitBranchMock.mockReset();
    getCurrentBranchMock.mockReset();
    getCurrentBranchMock.mockResolvedValue("Detached HEAD");
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo/ef7f",
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
          id: "tab-1",
          repoPath: "/repo/ef7f",
          selectedBranch: "codex/test-remote2",
          selectedCommit: null,
        },
      ],
      activeTabId: "tab-1",
      recentRepos: [],
      favoriteRepos: [],
    });
    useGitActionsStore.setState({ pendingAction: null, notice: null });
    useWorkspaceUiStore.setState({
      repoStateByPath: {},
      pullStrategy: "pull-ff-if-possible",
      pushMode: "push-branch",
    });
  });

  it("clears stale selected branches when the repository is detached", async () => {
    const { result } = renderHook(() => useBranchListBehavior());

    await waitFor(() => {
      expect(result.current.selectedBranch).toBeNull();
    });
    expect(useRepoStore.getState().tabs[0]?.selectedBranch).toBeNull();
  });

  it("checks out remote branches through the tracking checkout command", async () => {
    getRepositoryStateMock
      .mockResolvedValueOnce({
      path: "/repo/ef7f",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
      })
      .mockResolvedValue({
        path: "/repo/ef7f",
        isValid: true,
        branch: "feature/login",
        headStatus: "normal",
        hasCommits: true,
        isUnborn: false,
        isDetached: false,
      });
    getCurrentBranchMock.mockResolvedValue("feature/login");
    checkoutRemoteGitBranchMock.mockResolvedValue(undefined);
    useRepoStore.setState({
      tabs: [
        {
          id: "tab-1",
          repoPath: "/repo/ef7f",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "tab-1",
      recentRepos: [],
      favoriteRepos: [],
    });

    const { result } = renderHook(() => useBranchListBehavior());

    await waitFor(() => {
      expect(result.current.selectedBranch).toBe("main");
    });

    await result.current.checkoutBranch("origin/feature/login");

    expect(checkoutRemoteGitBranchMock).toHaveBeenCalledWith(
      "/repo/ef7f",
      "origin/feature/login",
    );
    await waitFor(() => {
      expect(useRepoStore.getState().tabs[0]?.selectedBranch).toBe(
        "feature/login",
      );
    });
    expect(useGitActionsStore.getState().notice).toMatchObject({
      kind: "success",
      title: "Checked out branch",
    });
  });
});
