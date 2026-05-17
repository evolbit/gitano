import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import { useStageAndCommit } from "./use-stage-and-commit";

const commitStagedChangesMock = vi.hoisted(() => vi.fn());
const hasStagedChangesMock = vi.hoisted(() => vi.fn());
const pushRepositoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/staging", () => ({
  commitStagedChanges: commitStagedChangesMock,
  hasStagedChanges: hasStagedChangesMock,
  pushRepository: pushRepositoryMock,
}));

describe("useStageAndCommit", () => {
  beforeEach(() => {
    commitStagedChangesMock.mockReset();
    hasStagedChangesMock.mockReset();
    pushRepositoryMock.mockReset();
    useStagedLinesStore.getState().clearAllStagedLines();
  });

  it("commits, optionally pushes, and clears staged line state", async () => {
    hasStagedChangesMock.mockResolvedValueOnce(true);
    commitStagedChangesMock.mockResolvedValueOnce(undefined);
    pushRepositoryMock.mockResolvedValueOnce(undefined);
    useStagedLinesStore
      .getState()
      .setStagedLines("src/file.ts", 0, new Set([1, 2]));

    const { result } = renderHook(() => useStageAndCommit());

    await act(async () => {
      await result.current.commitStagedChanges("/repo", "Commit message", {
        amend: true,
        push: true,
      });
    });

    expect(hasStagedChangesMock).toHaveBeenCalledWith("/repo");
    expect(commitStagedChangesMock).toHaveBeenCalledWith(
      "/repo",
      "Commit message",
      true,
    );
    expect(pushRepositoryMock).toHaveBeenCalledWith("/repo");
    expect(useStagedLinesStore.getState().stagedLines).toEqual({});
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("reports an error and skips commit when there are no staged changes", async () => {
    hasStagedChangesMock.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useStageAndCommit());

    await act(async () => {
      await expect(
        result.current.commitStagedChanges("/repo", "Commit message"),
      ).rejects.toThrow("There are no staged changes to commit.");
    });

    expect(commitStagedChangesMock).not.toHaveBeenCalled();
    expect(pushRepositoryMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe(
      "Error: There are no staged changes to commit.",
    );
    expect(result.current.loading).toBe(false);
  });
});
