import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace";
import CommitList from "./commit-list";

const getCommitHistoryWindowMock = vi.hoisted(() => vi.fn());
const getCommitGraphWindowMock = vi.hoisted(() => vi.fn());
const getRemoteUrlMock = vi.hoisted(() => vi.fn());
const prepareCommitHistoryMock = vi.hoisted(() => vi.fn());
const searchCommitHistoryMock = vi.hoisted(() => vi.fn());
const getRepositoryStateMock = vi.hoisted(() => vi.fn());
const listenToLocalAiRunProgressMock = vi.hoisted(() => vi.fn());
const listenToExternalAiRunEventsMock = vi.hoisted(() => vi.fn());
const runLocalAiActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/commits", () => ({
  cherryPickCommit: vi.fn(),
  getCommitGraphWindow: getCommitGraphWindowMock,
  getCommitHistoryWindow: getCommitHistoryWindowMock,
  getCommitPatch: vi.fn(),
  getRemoteUrl: getRemoteUrlMock,
  prepareCommitHistory: prepareCommitHistoryMock,
  revertCommit: vi.fn(),
  searchCommitHistory: searchCommitHistoryMock,
}));

vi.mock(
  "@/shared/components/tables/table-virtual-resizable/table-virtual-resizable",
  () => ({
    default: ({
      data,
      getPlaceholderRow,
      onVisibleRangeChange,
      onRowClick,
      selectedRowIndex,
    }: {
      data: Array<{ id: string; message: string }>;
      getPlaceholderRow?: (absoluteIndex: number) => {
        id: string;
        message: string;
        refs: string[];
      } | null;
      onVisibleRangeChange?: (range: {
        startIndex: number;
        endIndex: number;
      }) => void;
      onRowClick?: (row: unknown, index: number) => void;
      selectedRowIndex?: number;
    }) => {
      const placeholderRow = getPlaceholderRow?.(5_000);

      return (
        <div data-virtualizer-scroll>
          <button
            type="button"
            data-testid="visible-range-bottom"
            onClick={() =>
              onVisibleRangeChange?.({ startIndex: 1_980, endIndex: 1_999 })
            }
          >
            visible bottom
          </button>
          <button
            type="button"
            data-testid="visible-range-far"
            onClick={() =>
              onVisibleRangeChange?.({ startIndex: 5_000, endIndex: 5_020 })
            }
          >
            visible far
          </button>
          {placeholderRow ? (
            <span>
              {placeholderRow.refs.join(" ")} {placeholderRow.message}
            </span>
          ) : null}
          {data.map((row, index) => (
            <button
              key={row.id}
              type="button"
              data-selected={selectedRowIndex === index ? "true" : "false"}
              onClick={() => onRowClick?.(row, index)}
            >
              {row.message}
            </button>
          ))}
        </div>
      );
    },
  }),
);

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
    getCommitHistoryWindowMock.mockReset();
    getCommitGraphWindowMock.mockReset();
    getRemoteUrlMock.mockReset();
    prepareCommitHistoryMock.mockReset();
    searchCommitHistoryMock.mockReset();
    getRepositoryStateMock.mockReset();
    listenToLocalAiRunProgressMock.mockReset();
    listenToExternalAiRunEventsMock.mockReset();
    runLocalAiActionMock.mockReset();
    listenToLocalAiRunProgressMock.mockResolvedValue(vi.fn());
    listenToExternalAiRunEventsMock.mockResolvedValue(vi.fn());
    prepareCommitHistoryMock.mockResolvedValue({
      status: "ready",
      totalCount: 0,
      error: null,
    });
    getCommitHistoryWindowMock.mockResolvedValue({
      commits: [],
      offset: 0,
      limit: 2_000,
      totalCount: 0,
      hasPrevious: false,
      hasMore: false,
    });
    getCommitGraphWindowMock.mockResolvedValue({
      rows: [],
      offset: 0,
      limit: 200,
      totalCount: 0,
    });
    searchCommitHistoryMock.mockResolvedValue({
      query: "",
      matchCount: 0,
      currentMatchPosition: null,
      matchedRowIndex: null,
      matchedSha: null,
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

  it("uses backend search to navigate to an off-window commit match", async () => {
    const initialCommit = {
      sha: "initial-sha",
      message: "Initial import",
      author: "Ada",
      author_initial: "A",
      date: 1_700_000_000,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };
    const matchedCommit = {
      sha: "match-sha",
      message: "Fix cache",
      author: "Grace",
      author_initial: "G",
      date: 1_700_000_100,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };

    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    getCommitHistoryWindowMock
      .mockResolvedValueOnce({
        commits: [initialCommit],
        offset: 0,
        limit: 2_000,
        totalCount: 6_000,
        hasPrevious: false,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        commits: [matchedCommit],
        offset: 4_500,
        limit: 2_000,
        totalCount: 6_000,
        hasPrevious: true,
        hasMore: true,
      });
    searchCommitHistoryMock
      .mockResolvedValueOnce({
        query: "fix",
        matchCount: 1,
        currentMatchPosition: null,
        matchedRowIndex: null,
        matchedSha: null,
      })
      .mockResolvedValueOnce({
        query: "fix",
        matchCount: 1,
        currentMatchPosition: 0,
        matchedRowIndex: 5_000,
        matchedSha: "match-sha",
      });

    renderCommitList();

    expect(await screen.findByText("Initial import")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Search commits...");
    fireEvent.change(input, { target: { value: "fix" } });

    await waitFor(() =>
      expect(searchCommitHistoryMock).toHaveBeenCalledWith({
        path: "/repo",
        query: "fix",
        currentRowIndex: undefined,
        direction: undefined,
      }),
    );

    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Fix cache")).toBeInTheDocument();
    expect(useRepoStore.getState().tabs[0].selectedCommit?.sha).toBe(
      "match-sha",
    );
  });

  it("loads a backend window around the visible range when scrolling near the loaded window bottom", async () => {
    const firstWindowCommits = Array.from({ length: 2_000 }, (_, index) => ({
      sha: `newest-sha-${index}`,
      message:
        index === 0
          ? "Newest visible commit"
          : `Loaded visible commit ${index}`,
      author: "Ada",
      author_initial: "A",
      date: 1_700_000_000 - index,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    }));
    const nextWindowCommit = {
      sha: "older-sha",
      message: "Older paged commit",
      author: "Grace",
      author_initial: "G",
      date: 1_690_000_000,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    };

    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    getCommitHistoryWindowMock
      .mockResolvedValueOnce({
        commits: firstWindowCommits,
        offset: 0,
        limit: 2_000,
        totalCount: 4_000,
        hasPrevious: false,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        commits: [nextWindowCommit],
        offset: 1,
        limit: 2_000,
        totalCount: 4_000,
        hasPrevious: true,
        hasMore: true,
      });

    renderCommitList();

    expect(await screen.findByText("Newest visible commit")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("visible-range-bottom"));

    expect(await screen.findByText("Older paged commit")).toBeInTheDocument();
    expect(getCommitHistoryWindowMock).toHaveBeenLastCalledWith({
      path: "/repo",
      offset: undefined,
      limit: 2_000,
      anchorSha: undefined,
      anchorRowIndex: 1_999,
    });
  });

  it("renders loading placeholders while graph viewport data loads separately", async () => {
    const firstWindowCommits = Array.from({ length: 2_000 }, (_, index) => ({
      sha: `newest-sha-${index}`,
      message:
        index === 0
          ? "Newest visible commit"
          : `Loaded visible commit ${index}`,
      author: "Ada",
      author_initial: "A",
      date: 1_700_000_000 - index,
      current_branch: "main",
      source_branch: "main",
      commit_history: [],
      files: 1,
    }));

    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    getCommitHistoryWindowMock.mockResolvedValue({
      commits: firstWindowCommits,
      offset: 0,
      limit: 2_000,
      totalCount: 12_000,
      hasPrevious: false,
      hasMore: true,
    });
    getCommitGraphWindowMock.mockResolvedValue({
      rows: [
        {
          rowIndex: 5_000,
          graphWidth: 6,
          graphLane: 1,
          graphColor: 2,
          graphSegments: [],
          refs: ["main", "tag: v1.0.0"],
        },
      ],
      offset: 4_920,
      limit: 181,
      totalCount: 12_000,
    });

    renderCommitList();

    expect(await screen.findByText("Newest visible commit")).toBeInTheDocument();
    expect(screen.getByText(/Loading\.\.\./)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("visible-range-far"));

    await waitFor(() =>
      expect(getCommitGraphWindowMock).toHaveBeenCalledWith({
        path: "/repo",
        offset: 4_920,
        limit: 181,
      }),
    );
    expect(screen.getByText(/tag: v1.0.0/)).toBeInTheDocument();
  });
});
