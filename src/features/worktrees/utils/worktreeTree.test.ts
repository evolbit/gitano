import { describe, expect, it } from "vitest";
import type { GitWorktree } from "@/shared/types/git";
import type { BranchTreeNode } from "@/shared/lib/tree/branchTree";
import {
  getCreateBaseOptions,
  getWorktreeDisplayName,
  normalizeWorktreeSearch,
  pinMainWorktreeFirst,
} from "./worktreeTree";

function worktree(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: "/repo",
    name: "",
    branch: null,
    head: null,
    isCurrent: false,
    isMain: false,
    isBare: false,
    isDetached: false,
    ...overrides,
  };
}

describe("worktree tree utilities", () => {
  it("uses stable display names for main, named, and path-only worktrees", () => {
    expect(getWorktreeDisplayName(worktree({ isMain: true }))).toBe(
      "main worktree",
    );
    expect(getWorktreeDisplayName(worktree({ name: "feature-a" }))).toBe(
      "feature-a",
    );
    expect(getWorktreeDisplayName(worktree({ path: "/repos/app-copy" }))).toBe(
      "app-copy",
    );
  });

  it("normalizes search input", () => {
    expect(normalizeWorktreeSearch("  Feature/A  ")).toBe("feature/a");
  });

  it("pins the main worktree node first without mutating the original list", () => {
    const nodes: BranchTreeNode[] = [
      { type: "branch", name: "feature-a", full: "feature-a" },
      { type: "branch", name: "main worktree", full: "main worktree" },
    ];

    const sorted = pinMainWorktreeFirst(nodes, "main worktree");

    expect(sorted.map((node) => node.full)).toEqual([
      "main worktree",
      "feature-a",
    ]);
    expect(nodes.map((node) => node.full)).toEqual([
      "feature-a",
      "main worktree",
    ]);
  });

  it("offers the current branch and master as create bases", () => {
    expect(getCreateBaseOptions("feature/a")).toEqual([
      {
        refName: "feature/a",
        label: "Create new worktree based on feature/a",
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
});
