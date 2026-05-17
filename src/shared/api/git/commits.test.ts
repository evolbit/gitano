import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  amendCommitMessage,
  cherryPickCommit,
  getCommitDiff,
  getCommitPatch,
  getCommitsListPaginated,
  revertCommit,
} from "./commits";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("commit Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("requests paginated commit history with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({ commits: [], has_more: false });

    await getCommitsListPaginated({
      path: "/repo",
      offset: 0,
      limit: 100,
      forceRefresh: true,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "get_commits_list_paginated",
      {
        path: "/repo",
        offset: 0,
        limit: 100,
        forceRefresh: true,
      },
    );
  });

  it("requests commit diffs with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({ commitSha: "abc123", changes: [] });

    await getCommitDiff("/repo", "abc123");

    expect(invokeCommandMock).toHaveBeenCalledWith("get_commit_diff", {
      path: "/repo",
      sha: "abc123",
    });
  });

  it("amends commit messages with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await amendCommitMessage("/repo", "abc123", "New message");

    expect(invokeCommandMock).toHaveBeenCalledWith("amend_commit_message", {
      path: "/repo",
      sha: "abc123",
      newMessage: "New message",
    });
  });

  it("requests commit patches with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce("patch");

    await getCommitPatch("/repo", "abc123");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_commit_patch", {
      path: "/repo",
      sha: "abc123",
    });
  });

  it("cherry-picks commits with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await cherryPickCommit("/repo", "abc123");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_cherry_pick_commit", {
      path: "/repo",
      sha: "abc123",
    });
  });

  it("reverts commits with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await revertCommit("/repo", "abc123");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_revert_commit", {
      path: "/repo",
      sha: "abc123",
    });
  });
});
