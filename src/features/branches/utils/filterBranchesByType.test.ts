import { describe, expect, it } from "vitest";
import { filterBranchesByType } from "./filterBranchesByType";

describe("filterBranchesByType", () => {
  const branches = [
    "main",
    "develop",
    "feature/login",
    "bugfix/crash",
    "codex/test-remote",
    "origin/main",
    "origin/feature/remote-login",
    "upstream/release",
  ];

  it("keeps local slash branches and removes known remote branches", () => {
    expect(
      filterBranchesByType(branches, "local", [
        "origin/main",
        "origin/feature/remote-login",
        "upstream/release",
      ]),
    ).toEqual([
      "main",
      "develop",
      "feature/login",
      "bugfix/crash",
      "codex/test-remote",
    ]);
  });

  it("keeps remote command results unchanged for remote branches", () => {
    expect(filterBranchesByType(branches, "remote")).toEqual([
      "main",
      "develop",
      "feature/login",
      "bugfix/crash",
      "codex/test-remote",
      "origin/main",
      "origin/feature/remote-login",
      "upstream/release",
    ]);
  });
});
