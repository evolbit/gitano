import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  commitStagedChanges,
  discardFileChanges,
  getWorkingDirectoryChanges,
  hasStagedChanges,
  pushRepository,
  stageAll,
  stageFile,
  stageLines,
  trashUntrackedFile,
  unstageAll,
  unstageFile,
} from "./staging";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("staging Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
    invokeCommandMock.mockResolvedValue(undefined);
  });

  it.each([
    [getWorkingDirectoryChanges, "get_working_directory_changes"],
    [hasStagedChanges, "git_has_staged_changes"],
    [pushRepository, "git_push"],
    [stageAll, "git_stage_all"],
    [unstageAll, "git_unstage_all"],
  ])("passes repo-only calls through to %s", async (fn, command) => {
    await fn("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith(command, { path: "/repo" });
  });

  it.each([
    [stageFile, "git_add_file"],
    [unstageFile, "git_unstage_file"],
    [discardFileChanges, "git_discard_file_changes"],
    [trashUntrackedFile, "trash_untracked_file"],
  ])("passes file-targeted calls through to %s", async (fn, command) => {
    await fn("/repo", "src/file.ts");

    expect(invokeCommandMock).toHaveBeenCalledWith(command, {
      path: "/repo",
      filePath: "src/file.ts",
    });
  });

  it("preserves commit messages and amend mode", async () => {
    await commitStagedChanges("/repo", "ship it", true);

    expect(invokeCommandMock).toHaveBeenCalledWith("git_commit", {
      path: "/repo",
      message: "ship it",
      amend: true,
    });
  });

  it("defaults commits to non-amend mode", async () => {
    await commitStagedChanges("/repo", "ship it");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_commit", {
      path: "/repo",
      message: "ship it",
      amend: false,
    });
  });

  it("passes selected hunk lines through unchanged", async () => {
    await stageLines("/repo", "src/file.ts", { 1: [2, 4] });

    expect(invokeCommandMock).toHaveBeenCalledWith("git_stage_lines", {
      path: "/repo",
      filePath: "src/file.ts",
      hunks: { 1: [2, 4] },
    });
  });
});
