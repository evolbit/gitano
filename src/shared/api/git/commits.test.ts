import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  amendCommitMessage,
  cherryPickCommit,
  getCommitDiff,
  getCommitGraphWindow,
  getCommitHistoryWindow,
  getCommitPatch,
  getCommitsListPaginated,
  prepareCommitHistory,
  revertCommit,
  searchCommitHistory,
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

  it("prepares commit history with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      status: "loading",
      totalCount: 0,
      error: null,
    });

    await prepareCommitHistory({
      path: "/repo",
      historyMode: "git_log",
      forceRefresh: true,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("prepare_commit_history", {
      path: "/repo",
      historyMode: "git_log",
      forceRefresh: true,
    });
  });

  it("requests bounded commit history windows with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      commits: [],
      offset: 0,
      limit: 2_000,
      totalCount: 0,
      hasPrevious: false,
      hasMore: false,
    });

    await getCommitHistoryWindow({
      path: "/repo",
      offset: 10,
      limit: 100,
      anchorRowIndex: 25,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "get_commit_history_window",
      {
        path: "/repo",
        historyMode: undefined,
        offset: 10,
        limit: 100,
        anchorSha: undefined,
        anchorRowIndex: 25,
      },
    );
  });

  it("requests bounded commit graph windows with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      rows: [],
      offset: 0,
      limit: 120,
      totalCount: 0,
    });

    await getCommitGraphWindow({
      path: "/repo",
      offset: 50,
      limit: 120,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("get_commit_graph_window", {
      path: "/repo",
      historyMode: undefined,
      offset: 50,
      limit: 120,
    });
  });

  it("searches commit history with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      query: "fix",
      matchCount: 1,
      currentMatchPosition: 0,
      matchedRowIndex: 5,
      matchedSha: "abc123",
    });

    await searchCommitHistory({
      path: "/repo",
      query: "fix",
      currentRowIndex: 3,
      direction: "next",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("search_commit_history", {
      path: "/repo",
      historyMode: undefined,
      query: "fix",
      currentRowIndex: 3,
      direction: "next",
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
