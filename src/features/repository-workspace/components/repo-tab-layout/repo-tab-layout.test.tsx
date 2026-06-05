import { MantineProvider } from "@mantine/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import type { DiffHunk, WorkingFileDetailResponse } from "@/shared/types/git";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "@/features/repository-workspace/stores/workspace-ui-store";
import {
  DEFAULT_REPOSITORY_SURFACE_STATE,
  REPOSITORY_SURFACES,
  useRepositorySurfaceStore,
} from "@/features/repository-workspace/stores/repository-surface-store";
import RepoTabLayout from "./repo-tab-layout";

const loadFileDetailMock = vi.hoisted(() => vi.fn());
const clearFileHunksMock = vi.hoisted(() => vi.fn());
const setFileHunksMock = vi.hoisted(() => vi.fn());
const workingChangesMockState = vi.hoisted(() => ({
  changes: [
    {
      path: "src/app.ts",
      status: "modified",
      insertions: 1,
      deletions: 0,
      isUntracked: false,
      fileSignature: "src/app.ts:modified:1:0",
    },
  ],
  fileDetails: {},
}));

function hunkFixture(): DiffHunk {
  return {
    header: "@@ -1 +1 @@",
    old_start: 1,
    old_lines: 1,
    new_start: 1,
    new_lines: 1,
    is_new_file: false,
    lines: [
      {
        kind: "Add",
        content: "next",
        old_lineno: null,
        new_lineno: 1,
      },
    ],
  };
}

function readyDetail(path: string): WorkingFileDetailResponse {
  return {
    fileSignature: `${path}:modified:1:0`,
    file: {
      path,
      status: "modified",
      insertions: 1,
      deletions: 0,
      hunks: [hunkFixture()],
    },
    stagedState: null,
  };
}

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@gfazioli/mantine-split-pane", () => {
  const Split = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Split.Pane = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Split.Resizer = () => <div data-testid="split-resizer" />;
  return { Split };
});

vi.mock("../top-toolbar/top-toolbar", () => ({
  default: () => <div>Toolbar</div>,
}));

vi.mock("@/features/working-changes", () => ({
  ChangesExplorer: ({
    files,
    onSelectFile,
  }: {
    files: Array<{ path: string }>;
    onSelectFile: (file: { path: string }) => void;
  }) => (
    <div>
      ChangesExplorer:{files.map((file) => file.path).join(",")}
      {files.map((file) => (
        <button key={file.path} type="button" onClick={() => onSelectFile(file)}>
          Select {file.path}
        </button>
      ))}
    </div>
  ),
  ConflictResolutionSurface: ({
    filePath,
    onClose,
    onSelectConflictPath,
  }: {
    filePath: string;
    onClose: () => void;
    onSelectConflictPath: (path: string) => void;
  }) => (
    <div>
      ConflictSurface:{filePath}
      <button type="button" onClick={onClose}>
        Close conflict
      </button>
      <button type="button" onClick={() => onSelectConflictPath("src/next.ts")}>
        Next conflict
      </button>
    </div>
  ),
  CurrentChangesCommitBar: () => <div>CommitBar</div>,
  useWorkingDirectoryChanges: () => ({
    changes: workingChangesMockState.changes,
    fileDetails: workingChangesMockState.fileDetails,
    loading: false,
    error: null,
    hasLoadedOnce: true,
    refreshChanges: vi.fn(),
    loadFileDetail: loadFileDetailMock,
  }),
}));

vi.mock("@/features/branches", () => ({ BranchList: () => <div>BranchList</div> }));
vi.mock("@/features/stashes", () => ({ StashesPanel: () => <div>StashesPanel</div> }));
vi.mock("@/features/tags", () => ({ TagsPanel: () => <div>TagsPanel</div> }));
vi.mock("@/features/worktrees", () => ({ WorkspacesPanel: () => <div>WorkspacesPanel</div> }));
vi.mock("@/features/history", () => ({
  ChangesPanel: () => <div>ChangesPanel</div>,
  CommitList: () => <div>CommitList</div>,
}));
vi.mock("@/features/diffs", () => ({
  InlineDiffSurface: ({ filePath }: { filePath: string }) => (
    <div>InlineDiff:{filePath}</div>
  ),
  useFileHunksStore: {
    getState: () => ({
      clearFileHunks: clearFileHunksMock,
      setFileHunks: setFileHunksMock,
    }),
  },
}));
vi.mock(
  "../repository-pull-requests-surface/repository-pull-requests-surface",
  () => ({
    RepositoryPullRequestsSurface: () => <div>PullRequestsSurface</div>,
  }),
);

describe("RepoTabLayout", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    workingChangesMockState.changes = [
      {
        path: "src/app.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/app.ts:modified:1:0",
      },
    ];
    workingChangesMockState.fileDetails = {};
    useRepoStore.setState({ tabs: [], activeTabId: null });
    useWorkspaceUiStore.setState({ repoStateByPath: {} });
    useRepositorySurfaceStore.setState({ repoSurfaceStateByPath: {} });
  });

  it("renders the active repository workspace and switches left-pane sections", () => {
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: null }],
    });
    useWorkspaceUiStore.setState({
      repoStateByPath: {
        "/repo": { ...DEFAULT_REPO_WORKSPACE_STATE, leftPaneSection: "changes" },
      },
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    expect(screen.getByText("Toolbar")).toBeInTheDocument();
    expect(screen.getByText("ChangesExplorer:src/app.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Branches"));

    expect(useWorkspaceUiStore.getState().repoStateByPath["/repo"].leftPaneSection).toBe("branches");
    expect(screen.getByText("BranchList")).toBeInTheDocument();
  });

  it("shows the pull requests surface while keeping the workspace mounted", () => {
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [
        {
          id: "repo",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
    });
    useRepositorySurfaceStore.setState({
      repoSurfaceStateByPath: {
        "/repo": {
          ...DEFAULT_REPOSITORY_SURFACE_STATE,
          activeSurface: REPOSITORY_SURFACES.pullRequests,
        },
      },
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    expect(screen.getByText("Toolbar")).toBeInTheDocument();
    expect(screen.getByText("PullRequestsSurface")).toBeInTheDocument();
    expect(screen.getByText("ChangesExplorer:src/app.ts")).toBeInTheDocument();
  });

  it("requests file detail when a summary-only working file is selected", async () => {
    loadFileDetailMock.mockResolvedValueOnce(null);
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: null }],
    });
    useWorkspaceUiStore.setState({
      repoStateByPath: {
        "/repo": { ...DEFAULT_REPO_WORKSPACE_STATE, leftPaneSection: "changes" },
      },
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText("Select src/app.ts"));

    expect(await screen.findByText("InlineDiff:src/app.ts")).toBeInTheDocument();
    expect(loadFileDetailMock).toHaveBeenCalledWith("src/app.ts");
  });

  it("requests detail for each selected working file", async () => {
    loadFileDetailMock.mockResolvedValue(null);
    workingChangesMockState.changes = [
      ...workingChangesMockState.changes,
      {
        path: "src/other.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/other.ts:modified:1:0",
      },
    ];
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: null }],
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText("Select src/app.ts"));
    fireEvent.click(screen.getByText("Select src/other.ts"));

    expect(await screen.findByText("InlineDiff:src/other.ts")).toBeInTheDocument();
    expect(loadFileDetailMock).toHaveBeenCalledWith("src/app.ts");
    expect(loadFileDetailMock).toHaveBeenCalledWith("src/other.ts");
  });

  it("clears the working diff when the selected file disappears", async () => {
    workingChangesMockState.changes = [];
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: null }],
    });
    useWorkspaceUiStore.setState({
      repoStateByPath: {
        "/repo": {
          ...DEFAULT_REPO_WORKSPACE_STATE,
          rightWorkspaceMode: "working-diff",
          selectedWorkingDiffPath: "src/app.ts",
        },
      },
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    await screen.findByText("CommitList");
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"].selectedWorkingDiffPath,
    ).toBeNull();
  });

  it("opens conflict resolution for conflicted files while preserving normal diff state", async () => {
    loadFileDetailMock.mockResolvedValue(null);
    workingChangesMockState.changes = [
      {
        path: "src/app.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/app.ts:modified:1:0",
      },
      {
        path: "src/conflict.ts",
        status: ChangeType.Conflicted,
        insertions: 0,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/conflict.ts:conflicted",
      },
    ];
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: null }],
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText("Select src/app.ts"));
    expect(await screen.findByText("InlineDiff:src/app.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Select src/conflict.ts"));

    expect(screen.getByText("ConflictSurface:src/conflict.ts")).toBeInTheDocument();
    expect(loadFileDetailMock).toHaveBeenCalledTimes(1);
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"].rightWorkspaceMode,
    ).toBe("conflict-resolution");
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"].selectedWorkingDiffPath,
    ).toBe("src/app.ts");
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"].selectedConflictPath,
    ).toBe("src/conflict.ts");
  });

  it("returns from conflict resolution to normal working diff selection", async () => {
    loadFileDetailMock.mockResolvedValue(null);
    workingChangesMockState.changes = [
      {
        path: "src/conflict.ts",
        status: ChangeType.Conflicted,
        insertions: 0,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/conflict.ts:conflicted",
      },
      {
        path: "src/app.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/app.ts:modified:1:0",
      },
    ];
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: null }],
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText("Select src/conflict.ts"));
    expect(screen.getByText("ConflictSurface:src/conflict.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Select src/app.ts"));

    expect(await screen.findByText("InlineDiff:src/app.ts")).toBeInTheDocument();
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"].selectedConflictPath,
    ).toBeNull();
  });

  it("rebinds cached working diff hunks when reselecting the same tracked file after conflict resolution", async () => {
    workingChangesMockState.changes = [
      {
        path: "src/app.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/app.ts:modified:1:0",
      },
      {
        path: "src/conflict.ts",
        status: ChangeType.Conflicted,
        insertions: 0,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/conflict.ts:conflicted",
      },
    ];
    workingChangesMockState.fileDetails = {
      "src/app.ts": {
        status: "ready",
        detail: readyDetail("src/app.ts"),
      },
    };
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [
        {
          id: "repo",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
    });
    useWorkspaceUiStore.setState({
      repoStateByPath: {
        "/repo": {
          ...DEFAULT_REPO_WORKSPACE_STATE,
          rightWorkspaceMode: "working-diff",
          selectedWorkingDiffPath: "src/app.ts",
        },
      },
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(setFileHunksMock).toHaveBeenCalledWith(
        "src/app.ts",
        readyDetail("src/app.ts").file.hunks,
      );
    });
    setFileHunksMock.mockClear();

    fireEvent.click(screen.getByText("Select src/conflict.ts"));
    expect(screen.getByText("ConflictSurface:src/conflict.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Select src/app.ts"));

    expect(await screen.findByText("InlineDiff:src/app.ts")).toBeInTheDocument();
    await waitFor(() => {
      expect(setFileHunksMock).toHaveBeenCalledWith(
        "src/app.ts",
        readyDetail("src/app.ts").file.hunks,
      );
    });
  });

  it("closes conflict resolution and clears selected conflict path", () => {
    workingChangesMockState.changes = [
      {
        path: "src/conflict.ts",
        status: ChangeType.Conflicted,
        insertions: 0,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/conflict.ts:conflicted",
      },
    ];
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: null }],
    });

    render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText("Select src/conflict.ts"));
    expect(screen.getByText("ConflictSurface:src/conflict.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close conflict"));

    expect(screen.getByText("CommitList")).toBeInTheDocument();
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"].selectedConflictPath,
    ).toBeNull();
  });

  it("moves to the next conflict when the selected conflict disappears", async () => {
    workingChangesMockState.changes = [
      {
        path: "src/missing.ts",
        status: ChangeType.Conflicted,
        insertions: 0,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/missing.ts:conflicted",
      },
      {
        path: "src/next.ts",
        status: ChangeType.Conflicted,
        insertions: 0,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/next.ts:conflicted",
      },
    ];
    useRepoStore.setState({
      activeTabId: "repo",
      tabs: [{ id: "repo", repoPath: "/repo", selectedBranch: "main", selectedCommit: null }],
    });

    const view = render(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText("Select src/missing.ts"));
    expect(screen.getByText("ConflictSurface:src/missing.ts")).toBeInTheDocument();

    workingChangesMockState.changes = [
      {
        path: "src/next.ts",
        status: ChangeType.Conflicted,
        insertions: 0,
        deletions: 0,
        isUntracked: false,
        fileSignature: "src/next.ts:conflicted",
      },
    ];

    view.rerender(
      <MantineProvider>
        <RepoTabLayout />
      </MantineProvider>,
    );

    expect(await screen.findByText("ConflictSurface:src/next.ts")).toBeInTheDocument();
    expect(
      useWorkspaceUiStore.getState().repoStateByPath["/repo"].selectedConflictPath,
    ).toBe("src/next.ts");
  });
});
