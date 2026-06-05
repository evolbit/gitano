import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
  GIT_CONFLICT_STALE_ERROR_MESSAGE,
  type GitConflictSummary,
} from "@/shared/types/git-conflicts";
import {
  acceptConflictSide,
  getGitConflictErrorMessage,
  getMergeConflictContentRange,
  getMergeConflictFile,
  getMergeConflicts,
  GIT_CONFLICT_COMMANDS,
  isGitConflictStaleError,
  markConflictResolved,
  writeConflictResult,
} from "./conflicts";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("conflict Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
    invokeCommandMock.mockResolvedValue(undefined);
  });

  it("loads conflict summaries with the expected command and preserves size metadata", async () => {
    const summary = {
      path: "src/file.ts",
      status: ChangeType.Conflicted,
      conflictCount: 2,
      conflictKinds: [GIT_CONFLICT_KIND.BothModified],
      contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
      size: {
        byteSize: 12_000,
        lineCount: 600,
        sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
      },
      fileSignature: "file-signature",
    } satisfies GitConflictSummary;
    invokeCommandMock.mockResolvedValueOnce([summary]);

    const result = await getMergeConflicts("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith(GIT_CONFLICT_COMMANDS.List, {
      path: "/repo",
    });
    expect(result[0]?.status).toBe(ChangeType.Conflicted);
    expect(result[0]?.size.sizeClass).toBe(GIT_CONFLICT_SIZE_CLASS.Normal);
  });

  it("loads conflict detail with repo and file path", async () => {
    await getMergeConflictFile("/repo", "src/file.ts");

    expect(invokeCommandMock).toHaveBeenCalledWith(
      GIT_CONFLICT_COMMANDS.Detail,
      {
        path: "/repo",
        filePath: "src/file.ts",
      },
    );
  });

  it("loads conflict content ranges with bounded line payload", async () => {
    await getMergeConflictContentRange({
      repoPath: "/repo",
      filePath: "src/file.ts",
      side: GIT_CONFLICT_SIDE.Current,
      startLine: 200,
      lineCount: 40,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      GIT_CONFLICT_COMMANDS.ContentRange,
      {
        path: "/repo",
        filePath: "src/file.ts",
        side: GIT_CONFLICT_SIDE.Current,
        startLine: 200,
        lineCount: 40,
      },
    );
  });

  it("writes result content with expected signatures", async () => {
    await writeConflictResult({
      repoPath: "/repo",
      filePath: "src/file.ts",
      content: "merged",
      expectedIndexSignature: "index",
      expectedResultSignature: "result",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      GIT_CONFLICT_COMMANDS.WriteResult,
      {
        path: "/repo",
        filePath: "src/file.ts",
        content: "merged",
        expectedIndexSignature: "index",
        expectedResultSignature: "result",
      },
    );
  });

  it("accepts a side with expected signatures", async () => {
    await acceptConflictSide({
      repoPath: "/repo",
      filePath: "src/file.ts",
      side: GIT_CONFLICT_SIDE.Incoming,
      expectedIndexSignature: "index",
      expectedResultSignature: "result",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      GIT_CONFLICT_COMMANDS.AcceptSide,
      {
        path: "/repo",
        filePath: "src/file.ts",
        side: GIT_CONFLICT_SIDE.Incoming,
        expectedIndexSignature: "index",
        expectedResultSignature: "result",
      },
    );
  });

  it("marks a conflict resolved with expected signatures", async () => {
    await markConflictResolved({
      repoPath: "/repo",
      filePath: "src/file.ts",
      expectedIndexSignature: "index",
      expectedResultSignature: "result",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      GIT_CONFLICT_COMMANDS.MarkResolved,
      {
        path: "/repo",
        filePath: "src/file.ts",
        expectedIndexSignature: "index",
        expectedResultSignature: "result",
      },
    );
  });

  it("detects stale conflict errors from Tauri string and Error failures", () => {
    expect(isGitConflictStaleError(GIT_CONFLICT_STALE_ERROR_MESSAGE)).toBe(true);
    expect(
      isGitConflictStaleError(new Error(GIT_CONFLICT_STALE_ERROR_MESSAGE)),
    ).toBe(true);
    expect(isGitConflictStaleError("Different failure")).toBe(false);
  });

  it("extracts conflict error messages from supported error shapes", () => {
    expect(getGitConflictErrorMessage("failure")).toBe("failure");
    expect(getGitConflictErrorMessage(new Error("failure"))).toBe("failure");
    expect(getGitConflictErrorMessage({ message: "failure" })).toBeNull();
  });
});
