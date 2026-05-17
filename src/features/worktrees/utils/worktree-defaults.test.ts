import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDefaultWorktreeFolder,
  generateRandomWorkbranchName,
  getDefaultBranchFromName,
  getDefaultNameFromRef,
} from "./worktree-defaults";

describe("worktree defaults", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives safe worktree names from branch refs", () => {
    expect(getDefaultNameFromRef("refs/heads/feature/add worktrees")).toBe(
      "add-worktrees",
    );
  });

  it("derives branch names from user-entered names", () => {
    expect(getDefaultBranchFromName("release candidate")).toBe("release-candidate");
  });

  it("places sibling worktrees under a repo-scoped folder", () => {
    expect(buildDefaultWorktreeFolder("/Users/me/repo", "feature/a")).toBe(
      "/Users/me/repo.worktrees/feature-a",
    );
  });

  it("generates deterministic unused workbranch names when crypto is stubbed", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (values: Uint32Array) => {
        values[0] = 0;
        return values;
      },
    });

    expect(generateRandomWorkbranchName()).toBe("amber-atlas");
    expect(generateRandomWorkbranchName(["amber-atlas"])).toBe(
      "inky-stork-100",
    );
  });
});
