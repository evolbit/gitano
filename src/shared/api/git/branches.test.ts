import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkoutRemoteGitBranch,
  createGitBranch,
  deleteGitBranch,
  deleteRemoteGitBranch,
  getBranchRefs,
  getBranches,
  runGitBranchOperation,
  runRemoteGitBranchOperation,
} from "./branches";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("branch Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("uses the local branches command for local branch lists", async () => {
    invokeCommandMock.mockResolvedValueOnce(["main"]);

    await expect(getBranches("/repo", "local")).resolves.toEqual(["main"]);

    expect(invokeCommandMock).toHaveBeenCalledWith("get_branches", {
      path: "/repo",
    });
  });

  it("uses the remote branches command for remote branch lists", async () => {
    invokeCommandMock.mockResolvedValueOnce(["origin/main"]);

    await expect(getBranches("/repo", "remote")).resolves.toEqual([
      "origin/main",
    ]);

    expect(invokeCommandMock).toHaveBeenCalledWith("get_remote_branches", {
      path: "/repo",
    });
  });

  it("uses the unified branch refs command", async () => {
    const refs = [
      {
        name: "main",
        localName: "main",
        originName: "origin/main",
        localTargetId: "abc",
        originTargetId: "abc",
        upstreamName: "origin/main",
        presence: "local-origin",
        aheadCount: 0,
        behindCount: 0,
      },
    ];
    invokeCommandMock.mockResolvedValueOnce(refs);

    await expect(getBranchRefs("/repo")).resolves.toEqual(refs);

    expect(invokeCommandMock).toHaveBeenCalledWith("get_branch_refs", {
      path: "/repo",
    });
  });

  it("preserves branch mutation payloads", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await createGitBranch("/repo", "feature/auth", "main");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_create_branch", {
      path: "/repo",
      branchName: "feature/auth",
      baseRef: "main",
    });
  });


  it("passes branch deletion force mode", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await deleteGitBranch("/repo", "feature/auth", true);

    expect(invokeCommandMock).toHaveBeenCalledWith("git_delete_branch", {
      path: "/repo",
      branchName: "feature/auth",
      force: true,
    });
  });

  it("checks out remote branches through the tracking checkout command", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await checkoutRemoteGitBranch("/repo", "origin/feature/auth");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_checkout_remote_branch", {
      path: "/repo",
      branchName: "origin/feature/auth",
    });
  });

  it("passes typed remote branch operation commands through", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await runRemoteGitBranchOperation(
      "/repo",
      "git_branch_merge_remote_into_current",
      "origin/feature/auth",
    );

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "git_branch_merge_remote_into_current",
      {
        path: "/repo",
        branchName: "origin/feature/auth",
      },
    );
  });

  it("deletes remote branches through the remote delete command", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await deleteRemoteGitBranch("/repo", "origin/feature/auth");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_delete_remote_branch", {
      path: "/repo",
      branchName: "origin/feature/auth",
    });
  });

  it("passes typed branch operation commands through", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await runGitBranchOperation(
      "/repo",
      "git_branch_rebase_onto",
      "feature/auth",
      "main",
    );

    expect(invokeCommandMock).toHaveBeenCalledWith("git_branch_rebase_onto", {
      path: "/repo",
      targetBranch: "feature/auth",
      sourceBranch: "main",
    });
  });
});
