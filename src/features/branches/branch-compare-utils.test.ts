import { describe, expect, it } from "vitest";
import {
  buildBranchTargetOptions,
  getDefaultBranchComparisonBase,
} from "./branch-compare-utils";

describe("branch compare utilities", () => {
  it("uses the current branch as default base when it is valid", () => {
    expect(
      getDefaultBranchComparisonBase({
        currentBranch: "main",
        localBranches: ["main", "feature/auth"],
        remoteBranches: ["origin/main"],
        sourceBranch: "feature/auth",
      }),
    ).toBe("main");
  });

  it("falls back to another local branch when current branch is the source", () => {
    expect(
      getDefaultBranchComparisonBase({
        currentBranch: "feature/auth",
        localBranches: ["feature/auth", "develop", "feature/payments"],
        remoteBranches: ["origin/main"],
        sourceBranch: "feature/auth",
      }),
    ).toBe("develop");
  });

  it("prefers common base branches before arbitrary feature branches", () => {
    expect(
      getDefaultBranchComparisonBase({
        currentBranch: "feature/auth",
        localBranches: ["feature/auth", "feature/payments", "main"],
        remoteBranches: ["origin/main"],
        sourceBranch: "feature/auth",
      }),
    ).toBe("main");
  });

  it("excludes the source branch from local and remote target options", () => {
    expect(
      buildBranchTargetOptions({
        localBranches: ["main", "feature/auth"],
        remoteBranches: ["origin/main", "feature/auth"],
        sourceBranch: "feature/auth",
      }),
    ).toEqual([
      { section: "local", name: "main" },
      { section: "remote", name: "origin/main" },
    ]);
  });
});
