import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCommitFileDiff, getDiffContext, getStashFileDiff } from "./diffs";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("diff Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("requests commit file diffs with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await getCommitFileDiff({
      path: "/repo",
      sha: "abc123",
      filePath: "src/file.ts",
      context: 3,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("get_commit_file_diff", {
      path: "/repo",
      sha: "abc123",
      filePath: "src/file.ts",
      context: 3,
    });
  });

  it("requests stash file diffs with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await getStashFileDiff({
      path: "/repo",
      sha: "stash@{0}",
      filePath: "src/file.ts",
      context: 3,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("get_stash_file_diff", {
      path: "/repo",
      sha: "stash@{0}",
      filePath: "src/file.ts",
      context: 3,
    });
  });

  it("requests extra diff context with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await getDiffContext({
      path: "/repo",
      filePath: "src/file.ts",
      hunkIndex: 1,
      direction: "Above",
      lines: 10,
      context: 3,
      offset: 0,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("get_diff_context", {
      path: "/repo",
      filePath: "src/file.ts",
      hunkIndex: 1,
      direction: "Above",
      lines: 10,
      context: 3,
      offset: 0,
    });
  });
});
