import { describe, expect, it } from "vitest";
import type { GitWorktree } from "@/shared/types/git";
import {
  getCreateBaseOptions,
  getPathBasename,
  getPullStrategyLabel,
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
});
