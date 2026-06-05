import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import { ChangeType, type WorkingChangeFileSummary } from "@/shared/types/git";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictSummary,
} from "@/shared/types/git-conflicts";
import { useWorkingDirectoryChanges } from "./use-working-directory-changes";

const getMergeConflictsMock = vi.hoisted(() => vi.fn());
const getWorkingDirectorySummaryMock = vi.hoisted(() => vi.fn());
const getWorkingFileDetailMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/conflicts", () => ({
  getMergeConflicts: getMergeConflictsMock,
}));

vi.mock("@/shared/api/git/staging", () => ({
  getWorkingDirectorySummary: getWorkingDirectorySummaryMock,
  getWorkingFileDetail: getWorkingFileDetailMock,
}));

function createSummary(
  overrides: Partial<WorkingChangeFileSummary> = {},
): WorkingChangeFileSummary {
  return {
    path: "src/file.ts",
    status: "modified",
    insertions: 1,
    deletions: 0,
    isUntracked: false,
    fileSignature: "src/file.ts:modified:1:0",
    ...overrides,
  };
}

function createConflictSummary(
  overrides: Partial<GitConflictSummary> = {},
): GitConflictSummary {
  return {
    path: "src/conflict.ts",
    status: ChangeType.Conflicted,
    conflictCount: 1,
    conflictKinds: [GIT_CONFLICT_KIND.BothModified],
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    size: {
      byteSize: 100,
      lineCount: 10,
      sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
    },
    fileSignature: "src/conflict.ts:conflicted",
    ...overrides,
  };
}

describe("useWorkingDirectoryChanges", () => {
  beforeEach(() => {
    getMergeConflictsMock.mockReset();
    getMergeConflictsMock.mockResolvedValue([]);
    getWorkingDirectorySummaryMock.mockReset();
    getWorkingFileDetailMock.mockReset();
    useStagedLinesStore.getState().clearAllStagedLines();
  });

  it("loads working directory summaries and syncs staged summary state", async () => {
    const changes: WorkingChangeFileSummary[] = [
      createSummary({
        insertions: 2,
        deletions: 1,
        fileSignature: "src/file.ts:modified:2:1",
      }),
    ];
    getWorkingDirectorySummaryMock.mockResolvedValueOnce({
      changes,
      staged_state_by_file: {
        "src/file.ts": {
          isWholeFileStaged: true,
          hunks: {},
        },
      },
    });

    const { result } = renderHook(() => useWorkingDirectoryChanges("/repo"));

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(true);
    });

    expect(getWorkingDirectorySummaryMock).toHaveBeenCalledWith("/repo");
    expect(getMergeConflictsMock).toHaveBeenCalledWith("/repo");
    expect(result.current.changes).toEqual(changes);
    const stagedFile =
      useStagedLinesStore.getState().stagedLines["src/file.ts"];
    expect(stagedFile.isWholeFileStaged).toBe(true);
  });

  it("combines conflict summaries before normal working changes", async () => {
    getMergeConflictsMock.mockResolvedValueOnce([createConflictSummary()]);
    getWorkingDirectorySummaryMock.mockResolvedValueOnce({
      changes: [createSummary({ path: "src/normal.ts" })],
      staged_state_by_file: {},
    });

    const { result } = renderHook(() => useWorkingDirectoryChanges("/repo"));

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(true);
    });

    expect(result.current.changes.map((change) => change.path)).toEqual([
      "src/conflict.ts",
      "src/normal.ts",
    ]);
    expect(result.current.changes[0]).toMatchObject({
      status: ChangeType.Conflicted,
      insertions: 0,
      deletions: 0,
      conflictCount: 1,
    });
    expect(getWorkingFileDetailMock).not.toHaveBeenCalled();
  });

  it("clears state and avoids fetching when disabled", async () => {
    useStagedLinesStore
      .getState()
      .setStagedLines("src/file.ts", 0, new Set([1]));

    const { result } = renderHook(() =>
      useWorkingDirectoryChanges("/repo", { enabled: false }),
    );

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(false);
    });

    expect(getWorkingDirectorySummaryMock).not.toHaveBeenCalled();
    expect(result.current.changes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("coalesces overlapping refreshes into one follow-up request", async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    getWorkingDirectorySummaryMock
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce({
        changes: [],
        staged_state_by_file: {},
      });

    const { result } = renderHook(() => useWorkingDirectoryChanges("/repo"));

    await waitFor(() => {
      expect(getWorkingDirectorySummaryMock).toHaveBeenCalledTimes(1);
    });

    void result.current.refreshChanges();
    void result.current.refreshChanges();

    resolveFirst({
      changes: [],
      staged_state_by_file: {},
    });

    await waitFor(() => {
      expect(getWorkingDirectorySummaryMock).toHaveBeenCalledTimes(2);
    });
  });

  it("ignores stale summary responses after the hook is disabled", async () => {
    let resolveSummary: (value: unknown) => void = () => undefined;
    getWorkingDirectorySummaryMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSummary = resolve;
      }),
    );

    const { result, rerender } = renderHook(
      ({ enabled }) => useWorkingDirectoryChanges("/repo", { enabled }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(getWorkingDirectorySummaryMock).toHaveBeenCalledTimes(1);
    });

    rerender({ enabled: false });
    resolveSummary({
      changes: [createSummary()],
      staged_state_by_file: {
        "src/file.ts": {
          isWholeFileStaged: true,
          hunks: {},
        },
      },
    });

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(false);
    });
    expect(result.current.changes).toEqual([]);
    expect(useStagedLinesStore.getState().stagedLines).toEqual({});
  });

  it("invalidates cached file detail when summary freshness changes", async () => {
    getWorkingDirectorySummaryMock
      .mockResolvedValueOnce({
        changes: [createSummary({ fileSignature: "sig-1" })],
        staged_state_by_file: {},
      })
      .mockResolvedValueOnce({
        changes: [createSummary({ fileSignature: "sig-2" })],
        staged_state_by_file: {},
      });
    getWorkingFileDetailMock.mockResolvedValueOnce({
      file: {
        path: "src/file.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
        hunks: [],
      },
      stagedState: null,
      fileSignature: "sig-1",
    });

    const { result } = renderHook(() => useWorkingDirectoryChanges("/repo"));

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(true);
    });

    await result.current.loadFileDetail("src/file.ts");
    await waitFor(() => {
      expect(result.current.fileDetails["src/file.ts"]?.status).toBe("ready");
    });

    await result.current.refreshChanges();

    await waitFor(() => {
      expect(result.current.fileDetails["src/file.ts"]).toBeUndefined();
    });
  });

  it("loads file detail on demand and syncs exact staged lines", async () => {
    getWorkingDirectorySummaryMock.mockResolvedValueOnce({
      changes: [],
      staged_state_by_file: {},
    });
    getWorkingFileDetailMock.mockResolvedValueOnce({
      file: {
        path: "src/file.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
        hunks: [],
      },
      stagedState: {
        hunks: {
          0: [2],
        },
      },
      fileSignature: "src/file.ts:modified:1:0",
    });

    const { result } = renderHook(() => useWorkingDirectoryChanges("/repo"));

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(true);
    });

    await result.current.loadFileDetail("src/file.ts");

    expect(getWorkingFileDetailMock).toHaveBeenCalledWith(
      "/repo",
      "src/file.ts",
    );
    await waitFor(() => {
      expect(result.current.fileDetails["src/file.ts"]?.status).toBe("ready");
    });
    expect(
      Array.from(
        useStagedLinesStore.getState().stagedLines["src/file.ts"][0],
      ),
    ).toEqual([2]);
  });

  it("ignores stale file detail responses for the same file", async () => {
    let resolveFirstDetail: (value: unknown) => void = () => undefined;
    getWorkingDirectorySummaryMock.mockResolvedValueOnce({
      changes: [],
      staged_state_by_file: {},
    });
    getWorkingFileDetailMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstDetail = resolve;
        }),
      )
      .mockResolvedValueOnce({
        file: {
          path: "src/file.ts",
          status: "modified",
          insertions: 2,
          deletions: 0,
          hunks: [],
        },
        stagedState: null,
        fileSignature: "sig-2",
      });

    const { result } = renderHook(() => useWorkingDirectoryChanges("/repo"));

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(true);
    });

    const firstLoad = result.current.loadFileDetail("src/file.ts");
    const secondLoad = result.current.loadFileDetail("src/file.ts");
    await secondLoad;

    resolveFirstDetail({
      file: {
        path: "src/file.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
        hunks: [],
      },
      stagedState: null,
      fileSignature: "sig-1",
    });
    await firstLoad;

    await waitFor(() => {
      expect(result.current.fileDetails["src/file.ts"]).toMatchObject({
        status: "ready",
        detail: {
          fileSignature: "sig-2",
        },
      });
    });
  });
});
