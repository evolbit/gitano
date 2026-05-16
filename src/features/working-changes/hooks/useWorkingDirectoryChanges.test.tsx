import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStagedLinesStore } from "@/features/working-changes/stores/stagingStore";
import type { FileChangeWithHunks } from "@/shared/types/git";
import { useWorkingDirectoryChanges } from "./useWorkingDirectoryChanges";

const getWorkingDirectoryChangesMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/staging", () => ({
  getWorkingDirectoryChanges: getWorkingDirectoryChangesMock,
}));

describe("useWorkingDirectoryChanges", () => {
  beforeEach(() => {
    getWorkingDirectoryChangesMock.mockReset();
    useStagedLinesStore.getState().clearAllStagedLines();
  });

  it("loads working directory changes and syncs staged line state", async () => {
    const changes: FileChangeWithHunks[] = [
      {
        path: "src/file.ts",
        status: "modified",
        insertions: 2,
        deletions: 1,
        hunks: [],
      },
    ];
    getWorkingDirectoryChangesMock.mockResolvedValueOnce({
      changes,
      staged_state_by_file: {
        "src/file.ts": {
          isNewFile: false,
          isWholeFileStaged: true,
          hunks: {
            0: [1, 2],
          },
        },
      },
    });

    const { result } = renderHook(() => useWorkingDirectoryChanges("/repo"));

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(true);
    });

    expect(getWorkingDirectoryChangesMock).toHaveBeenCalledWith("/repo");
    expect(result.current.changes).toEqual(changes);
    const stagedFile =
      useStagedLinesStore.getState().stagedLines["src/file.ts"];
    expect(stagedFile.isWholeFileStaged).toBe(true);
    expect(Array.from(stagedFile[0])).toEqual([1, 2]);
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

    expect(getWorkingDirectoryChangesMock).not.toHaveBeenCalled();
    expect(result.current.changes).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
