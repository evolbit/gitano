import { describe, expect, it } from "vitest";
import { filterBranchesByType } from "./filterBranchesByType";

describe("filterBranchesByType", () => {
  const branches = [
    "main",
    "develop",
    "feature/login",
    "bugfix/crash",
    "origin/main",
    "origin/feature/remote-login",
    "upstream/release",
  ];

  it("keeps plain and recognized local branch prefixes for local branches", () => {
    expect(filterBranchesByType(branches, "local")).toEqual([
      "main",
      "develop",
      "feature/login",
      "bugfix/crash",
    ]);
  });

  it("keeps remote-prefixed branches for remote branches", () => {
    expect(filterBranchesByType(branches, "remote")).toEqual([
      "feature/login",
      "bugfix/crash",
      "origin/main",
      "origin/feature/remote-login",
      "upstream/release",
    ]);
  });
});
