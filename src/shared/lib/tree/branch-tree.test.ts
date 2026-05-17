import { describe, expect, it } from "vitest";
import { getBranchPriority, groupBranches, groupNames } from "./branch-tree";

describe("branch tree helpers", () => {
  it("orders priority branch families before alphabetical branches", () => {
    const nodes = groupBranches([
      "feature/search",
      "stage",
      "main",
      "bugfix/crash",
      "develop",
    ]);

    expect(nodes.map((node) => node.name)).toEqual([
      "develop",
      "main",
      "stage",
      "bugfix",
      "feature",
    ]);
  });

  it("matches branch priority aliases", () => {
    expect(getBranchPriority("dev")).toBe(0);
    expect(getBranchPriority("master")).toBe(1);
    expect(getBranchPriority("qa")).toBe(2);
    expect(getBranchPriority("feature/auth")).toBe(99);
  });

  it("groups generic names alphabetically", () => {
    expect(groupNames(["zeta/item", "alpha/item"]).map((node) => node.name)).toEqual([
      "alpha",
      "zeta",
    ]);
  });
});
