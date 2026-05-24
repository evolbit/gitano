import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllRemotes,
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

  it("pushes the current branch", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await pushRepository("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_push", {
      path: "/repo",
    });
  });
});
