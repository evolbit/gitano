import {
  act,
  renderHook,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitListItem } from "@/shared/types/git";
import type { CommitTableRow } from "../types/commit-list";
import { useCommitContextMenuActions } from "./use-commit-context-menu-actions";

const getCommitPatchMock = vi.hoisted(() => vi.fn());
const writeClipboardTextFromPromiseMock = vi.hoisted(() => vi.fn());
const openExternalUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/commits", () => ({
  getCommitPatch: getCommitPatchMock,
}));

vi.mock("@/shared/platform/clipboard", () => ({
  writeClipboardTextFromPromise: writeClipboardTextFromPromiseMock,
}));

vi.mock("@/shared/platform/tauri/opener", () => ({
  openExternalUrl: openExternalUrlMock,
}));

const commit: CommitListItem = {
  sha: "abcdef1234567890",
  message: "Add context menu tests",
  author: "Ava",
  author_initial: "A",
  date: 1_700_000_000,
  current_branch: "main",
  source_branch: "main",
  commit_history: [],
  files: 1,
};

const row: CommitTableRow = {
  id: commit.sha,
  graphWidth: 1,
  graphLane: 0,
  graphColor: 0,
  graphSegments: [],
  refs: [],
  message: commit.message,
  date: commit.date,
  author: commit.author,
  authorInitial: commit.author_initial,
  sha: commit.sha,
  commit,
};

function renderContextMenuHook() {
  const copyText = vi.fn(async () => undefined);
  const notifyError = vi.fn();
  const notifySuccess = vi.fn();
  const openCommitDialog = vi.fn();
  const runCommitAiAnalysis = vi.fn(async () => undefined);
  const setCommitCompare = vi.fn();
  const setKeyboardNavigation = vi.fn();

  const hook = renderHook(() =>
    useCommitContextMenuActions({
      copyText,
      notifyError,
      notifySuccess,
      openCommitDialog,
      remoteUrl: "https://github.com/example/repo.git",
      repoPath: "/repo",
      runCommitAiAnalysis,
      selectedBranch: "main",
      setCommitCompare,
      setKeyboardNavigation,
    }),
  );

  return {
    ...hook,
    openCommitDialog,
    setKeyboardNavigation,
  };
}

describe("useCommitContextMenuActions", () => {
  beforeEach(() => {
    getCommitPatchMock.mockReset();
    writeClipboardTextFromPromiseMock.mockReset();
    openExternalUrlMock.mockReset();
  });

  it("opens a row context menu and routes create actions to the dialog", () => {
    const { result, openCommitDialog, setKeyboardNavigation } =
      renderContextMenuHook();
    const event = {
      clientX: 24,
      clientY: 48,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleRowContextMenu(row, 0, event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(setKeyboardNavigation).toHaveBeenCalledWith(false);
    expect(result.current.contextMenu?.row.commit.sha).toBe(commit.sha);
    expect(result.current.menuPos).toEqual({ x: 24, y: 48 });
    expect(result.current.remoteCommitUrl).toBe(
      "https://github.com/example/repo/commit/abcdef1234567890",
    );

    act(() => {
      result.current.handleCommitMenuAction("createBranch");
    });

    expect(openCommitDialog).toHaveBeenCalledWith("branch", commit);
    expect(result.current.contextMenu).toBeNull();
  });
});
