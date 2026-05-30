import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllRemotes,
  hasRemoteRefUpdates,
  pullRepository,
  pushRepository,
} from "./sync";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("sync Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("fetches all configured remotes for a repository", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await fetchAllRemotes("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_fetch", {
      path: "/repo",
      mode: "fetch-all",
    });
  });

  it("fetches all remotes with pruning when requested", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await fetchAllRemotes("/repo", "fetch-all-prune");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_fetch", {
      path: "/repo",
      mode: "fetch-all-prune",
    });
  });

  it("checks whether remote refs changed without fetching", async () => {
    invokeCommandMock.mockResolvedValueOnce(true);

    await expect(hasRemoteRefUpdates("/repo")).resolves.toBe(true);

    expect(invokeCommandMock).toHaveBeenCalledWith("git_remote_refs_changed", {
      path: "/repo",
    });
  });

  it("pulls with the selected strategy", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await pullRepository("/repo", "pull-rebase");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_pull", {
      path: "/repo",
      strategy: "pull-rebase",
    });
  });

  it("pushes the current branch by default", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await pushRepository("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_push", {
      path: "/repo",
      mode: "push-branch",
    });
  });

  it("pushes with the selected push mode", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await pushRepository("/repo", "push-branch-and-tags");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_push", {
      path: "/repo",
      mode: "push-branch-and-tags",
    });
  });
});
