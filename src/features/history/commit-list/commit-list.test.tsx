import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import CommitList from "./commit-list";

const getCommitsListPaginatedMock = vi.hoisted(() => vi.fn());
const getRemoteUrlMock = vi.hoisted(() => vi.fn());
const getRepositoryStateMock = vi.hoisted(() => vi.fn());
const listenToLocalAiRunProgressMock = vi.hoisted(() => vi.fn());
const listenToExternalAiRunEventsMock = vi.hoisted(() => vi.fn());
const runLocalAiActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/commits", () => ({
  cherryPickCommit: vi.fn(),
  getCommitPatch: vi.fn(),
  getCommitsListPaginated: getCommitsListPaginatedMock,
  getRemoteUrl: getRemoteUrlMock,
  revertCommit: vi.fn(),
}));

vi.mock("@/shared/api/git/tags", () => ({
  createTag: vi.fn(),
}));

vi.mock("@/shared/api/git/branches", () => ({
  createGitBranch: vi.fn(),
  createGitWorktree: vi.fn(),
}));

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: getRepositoryStateMock,
}));

vi.mock("@/shared/api/local-ai", () => ({
  listenToLocalAiRunProgress: listenToLocalAiRunProgressMock,
  listenToExternalAiRunEvents: listenToExternalAiRunEventsMock,
  runLocalAiAction: runLocalAiActionMock,
}));

vi.mock("@/shared/platform/clipboard", () => ({
  writeClipboardText: vi.fn(),
  writeClipboardTextFromPromise: vi.fn(),
}));

vi.mock("@/shared/platform/tauri/opener", () => ({
  openExternalUrl: vi.fn(),
}));

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

function renderCommitList() {
  return render(
    <MantineProvider>
      <CommitList />
    </MantineProvider>,
  );
}

describe("CommitList", () => {
  beforeEach(() => {
    getCommitsListPaginatedMock.mockReset();
    getRemoteUrlMock.mockReset();
    getRepositoryStateMock.mockReset();
    listenToLocalAiRunProgressMock.mockReset();
    listenToExternalAiRunEventsMock.mockReset();
    runLocalAiActionMock.mockReset();
    listenToLocalAiRunProgressMock.mockResolvedValue(vi.fn());
    listenToExternalAiRunEventsMock.mockResolvedValue(vi.fn());
    getCommitsListPaginatedMock.mockResolvedValue({
      commits: [],
      has_more: false,
    });
    getRemoteUrlMock.mockResolvedValue(null);
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "unborn",
      hasCommits: false,
      isUnborn: true,
      isDetached: false,
    });
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

  it("renders a first-commit empty state for unborn repositories", async () => {
    renderCommitList();

    expect(
      await screen.findByText(
        "Stage files and create the initial commit to start repository history.",
      ),
    ).toBeInTheDocument();
  });
});
