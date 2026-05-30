import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { useWorkspaceUiStore } from "@/features/repository-workspace/stores/workspace-ui-store";
import { getRepositoryState } from "@/shared/api/repositories";
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

vi.mock("../api", () => ({
  checkoutGitBranch: vi.fn(),
  createGitBranch: vi.fn(),
  createGitWorktree: vi.fn(),
  deleteGitBranch: vi.fn(),
  getBranches: vi.fn().mockResolvedValue([]),
  getBranchRefs: vi.fn().mockResolvedValue([]),
  getBranchTipSha: vi.fn(),
  getCurrentBranch: vi.fn().mockResolvedValue("Detached HEAD"),
  getWorktrees: vi.fn().mockResolvedValue([]),
  renameGitBranch: vi.fn(),
  runGitBranchOperation: vi.fn(),
  runRemoteBranchAction: vi.fn(),
}));

vi.mock("@/shared/platform/clipboard", () => ({
  writeClipboardText: vi.fn(),
  writeClipboardTextFromPromise: vi.fn(),
}));

const getRepositoryStateMock = vi.mocked(getRepositoryState);

describe("useBranchListBehavior", () => {
  beforeEach(() => {
    getRepositoryStateMock.mockReset();
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
});
