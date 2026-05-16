import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGitWorktree,
  getWorktrees,
  removeGitWorktree,
} from "./worktrees";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("worktree Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("lists worktrees with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await getWorktrees("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("get_worktrees", {
      path: "/repo",
    });
  });

  it("creates worktrees with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      path: "/repo-feature",
      branch: "feature/a",
    });

    await createGitWorktree("/repo", "/repo-feature", "feature/a", "main");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_create_worktree", {
      path: "/repo",
      worktreePath: "/repo-feature",
      branch: "feature/a",
      baseRef: "main",
    });
  });

  it("removes worktrees with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await removeGitWorktree("/repo", "/repo-feature", true);

    expect(invokeCommandMock).toHaveBeenCalledWith("git_remove_worktree", {
      path: "/repo",
      worktreePath: "/repo-feature",
      force: true,
    });
  });
});

