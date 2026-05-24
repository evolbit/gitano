import {
  act,
  renderHook,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitListItem } from "@/shared/types/git";
import { useCommitActionDialog } from "./use-commit-action-dialog";

const createGitBranchMock = vi.hoisted(() => vi.fn());
const createGitWorktreeMock = vi.hoisted(() => vi.fn());
const cherryPickCommitMock = vi.hoisted(() => vi.fn());
const revertCommitMock = vi.hoisted(() => vi.fn());
const createTagMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/worktrees", () => ({
  buildDefaultWorktreeFolder: vi.fn(
    (repoPath: string, branchName: string) => `${repoPath}/../${branchName}`,
  ),
}));

vi.mock("@/shared/api/git/branches", () => ({
  createGitBranch: createGitBranchMock,
  createGitWorktree: createGitWorktreeMock,
}));

vi.mock("@/shared/api/git/commits", () => ({
  cherryPickCommit: cherryPickCommitMock,
  revertCommit: revertCommitMock,
}));

vi.mock("@/shared/api/git/tags", () => ({
  createTag: createTagMock,
}));

const commit: CommitListItem = {
  sha: "abcdef1234567890",
  message: "Add cache invalidation",
  author: "Ava",
  author_initial: "A",
  date: 1_700_000_000,
  current_branch: "main",
  source_branch: "main",
  commit_history: [],
  files: 2,
};

function renderDialogHook() {
  const notifyError = vi.fn();
  const notifySuccess = vi.fn();
  const refreshRepositorySurfaces = vi.fn();

  const hook = renderHook(() =>
    useCommitActionDialog({
      notifyError,
      notifySuccess,
      refreshRepositorySurfaces,
      repoPath: "/repo",
      selectedBranch: "main",
    }),
  );

  return {
    ...hook,
    notifyError,
    notifySuccess,
    refreshRepositorySurfaces,
  };
}

describe("useCommitActionDialog", () => {
  beforeEach(() => {
    createGitBranchMock.mockReset();
    createGitWorktreeMock.mockReset();
    cherryPickCommitMock.mockReset();
    revertCommitMock.mockReset();
    createTagMock.mockReset();
    createGitBranchMock.mockResolvedValue(undefined);
  });

  it("initializes branch defaults and creates the branch from the selected commit", async () => {
    const { result, notifySuccess, refreshRepositorySurfaces } =
      renderDialogHook();

    act(() => {
      result.current.openCommitDialog("branch", commit);
    });

    expect(result.current.branchName).toBe("commit-abcdef1");
    expect(result.current.worktreePath).toBe("/repo/../commit-abcdef1");

    await act(async () => {
      await result.current.handleConfirmDialog();
    });

    expect(createGitBranchMock).toHaveBeenCalledWith(
      "/repo",
      "commit-abcdef1",
      commit.sha,
    );
    expect(notifySuccess).toHaveBeenCalledWith(
      "Created branch",
      "Created commit-abcdef1 from abcdef123456.",
    );
    expect(refreshRepositorySurfaces).toHaveBeenCalledTimes(1);
    expect(result.current.dialog).toBeNull();
  });
});
