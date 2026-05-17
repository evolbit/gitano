import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import CurrentChangesCommitBar from "./current-changes-commit-bar";

const getRepositoryStateMock = vi.hoisted(() => vi.fn());
const commitStagedChangesMock = vi.hoisted(() => vi.fn());
const hasStagedChangesMock = vi.hoisted(() => vi.fn());
const pushRepositoryMock = vi.hoisted(() => vi.fn());
const stashSelectedFilesMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: getRepositoryStateMock,
}));

vi.mock("@/shared/api/git/staging", () => ({
  commitStagedChanges: commitStagedChangesMock,
  hasStagedChanges: hasStagedChangesMock,
  pushRepository: pushRepositoryMock,
}));

vi.mock("@/shared/api/git/stashes", () => ({
  stashSelectedFiles: stashSelectedFilesMock,
}));

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe("CurrentChangesCommitBar", () => {
  beforeEach(() => {
    getRepositoryStateMock.mockReset();
    commitStagedChangesMock.mockReset();
    hasStagedChangesMock.mockReset();
    pushRepositoryMock.mockReset();
    stashSelectedFilesMock.mockReset();
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "unborn",
      hasCommits: false,
      isUnborn: true,
      isDetached: false,
    });
    useStagedLinesStore.getState().clearAllStagedLines();
    useStagedLinesStore
      .getState()
      .setStagedLines("file.txt", 0, new Set([0]));
    useRepoStore.setState({
      tabs: [
        {
          id: "repo-1",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo-1",
      recentRepos: [],
      favoriteRepos: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps first commit available while disabling unborn-only actions", async () => {
    const user = userEvent.setup();
    render(<CurrentChangesCommitBar repoPath="/repo" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Push")).toBeDisabled();
    });

    await user.type(screen.getByPlaceholderText("Enter commit message"), "initial");
    expect(screen.getByRole("button", { name: "Commit" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Commit options" }));
    expect(screen.getByRole("button", { name: "Amend" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stash" })).toBeDisabled();
  });
});
