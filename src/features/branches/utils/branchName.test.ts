import { describe, expect, it } from "vitest";
import type { BranchTreeNode } from "@/shared/lib/tree/branchTree";
import {
  buildBranchName,
  getBranchCreatePrefix,
  stripEdgeSlashes,
  stripRemotePrefix,
} from "./branchName";

describe("branch name utilities", () => {
  it("strips leading and trailing slashes", () => {
    expect(stripEdgeSlashes("/feature/auth/")).toBe("feature/auth");
    expect(stripEdgeSlashes("///")).toBe("");
  });

  it("builds branch names from optional prefixes", () => {
    expect(buildBranchName("feature", "auth")).toBe("feature/auth");
    expect(buildBranchName("feature/", "/auth/")).toBe("feature/auth");
    expect(buildBranchName("", "main")).toBe("main");
    expect(buildBranchName("feature", "")).toBe("");
  });

  it("strips the remote segment from remote branch paths", () => {
    expect(stripRemotePrefix("origin/feature/auth")).toBe("feature/auth");
    expect(stripRemotePrefix("origin")).toBe("");
  });

  it("gets create prefixes for local group and branch nodes", () => {
    const groupNode: BranchTreeNode = {
      type: "group",
      name: "feature",
      full: "feature/auth",
      children: [],
    };
    const branchNode: BranchTreeNode = {
      type: "branch",
      name: "login",
      full: "feature/auth/login",
    };

    expect(getBranchCreatePrefix(groupNode, "local")).toBe("feature/auth/");
    expect(getBranchCreatePrefix(branchNode, "local")).toBe("feature/auth/");
  });

  it("gets create prefixes from remote branch paths without the remote name", () => {
    const branchNode: BranchTreeNode = {
      type: "branch",
      name: "login",
      full: "origin/feature/auth/login",
    };

    expect(getBranchCreatePrefix(branchNode, "remote")).toBe("feature/auth/");
  });
});
