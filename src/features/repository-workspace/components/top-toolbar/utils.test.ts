import { describe, expect, it } from "vitest";
import type { GitWorktree } from "@/shared/types/git";
import {
  getCreateBaseOptions,
  getCurrentBranchLabel,
  getDetachedHeadLabel,
  getPathBasename,
  getPullStrategyLabel,
  getResolvedCurrentBranch,
  getWorktreeDisplayName,
  getWorktreeTargetLabel,
} from "./utils";

const worktree: GitWorktree = {
  path: "/repo/feature",
  name: "feature-worktree",
  branch: "feature",
  head: null,
  isCurrent: false,
  isMain: false,
  isBare: false,
  isDetached: false,
};

describe("top toolbar utilities", () => {
  it("formats pull strategy and path labels", () => {
    expect(getPullStrategyLabel("fetch-all-prune")).toBe(
      "Fetch All + Tags + Prune",
    );
    expect(getPullStrategyLabel("pull-rebase")).toBe("Pull (rebase)");
    expect(getPathBasename("/repo/project")).toBe("project");
    expect(getPathBasename("C:\\repo\\project")).toBe("project");
  });

  it("formats worktree labels and create-base options", () => {
    expect(getWorktreeDisplayName(worktree)).toBe("feature-worktree");
    expect(getWorktreeTargetLabel(worktree, "/repo")).toBe("feature-worktree");
    expect(getWorktreeTargetLabel(null, "/repo/project")).toBe("project");
    expect(getCreateBaseOptions("main")).toEqual([
      {
        refName: "main",
        label: "Create new worktree based on main",
      },
      {
        refName: "master",
        label: "Create new worktree based on master",
      },
    ]);
    expect(getCreateBaseOptions("Detached HEAD")).toEqual([
      {
        refName: "master",
        label: "Create new worktree based on master",
      },
    ]);
  });

  it("formats detached HEAD branch labels without falling back to a branch", () => {
    const repositoryState = {
      path: "/repo",
      isValid: true,
      branch: null,
      headStatus: "detached" as const,
      hasCommits: true,
      isUnborn: false,
      isDetached: true,
    };
    const currentWorktree = {
      ...worktree,
      branch: null,
      head: "a557509c78608700fd2b1c616b2c658260048dc8",
      isDetached: true,
    };

    expect(getDetachedHeadLabel("a557509c78608700fd2b1c616b2c658260048dc8")).toBe(
      "Detached HEAD @ a557509",
    );
    expect(
      getCurrentBranchLabel({
        currentBranch: "codex/test-remote2",
        isDetached: true,
        repositoryState,
        currentWorktree,
        isLoading: false,
      }),
    ).toBe("Detached HEAD @ a557509");
    expect(
      getResolvedCurrentBranch({
        currentBranch: "codex/test-remote2",
        isDetached: true,
        repositoryState,
        currentWorktree,
      }),
    ).toBeNull();
  });

  it("does not use persisted selected branches as current branch labels", () => {
    expect(
      getCurrentBranchLabel({
        currentBranch: null,
        isDetached: false,
        repositoryState: null,
        currentWorktree: null,
        isLoading: true,
      }),
    ).toBe("Loading...");
    expect(
      getResolvedCurrentBranch({
        currentBranch: null,
        isDetached: false,
        repositoryState: null,
        currentWorktree: null,
      }),
    ).toBeNull();
  });
});
