import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "@/features/repository-workspace/stores/workspace-ui-store";
import RepoTabLayout from "./repo-tab-layout";

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
  ChangesExplorer: ({ files }: { files: Array<{ path: string }> }) => (
    <div>ChangesExplorer:{files.map((file) => file.path).join(",")}</div>
  ),
  CurrentChangesCommitBar: () => <div>CommitBar</div>,
  useWorkingDirectoryChanges: () => ({
    changes: [{ path: "src/app.ts", status: "modified", insertions: 1, deletions: 0, hunks: [] }],
    loading: false,
    error: null,
    hasLoadedOnce: true,
    refreshChanges: vi.fn(),
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
vi.mock("@/features/diffs", () => ({ InlineDiffSurface: () => <div>InlineDiff</div> }));

describe("RepoTabLayout", () => {
  afterEach(() => {
    cleanup();
    useRepoStore.setState({ tabs: [], activeTabId: null });
    useWorkspaceUiStore.setState({ repoStateByPath: {} });
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
});
