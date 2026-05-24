import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import { useWorkspaceUiStore } from "@/features/repository-workspace/stores/workspace-ui-store";
import TopToolbar from "./top-toolbar";

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/shared/api/git/branches", () => ({
  getBranches: vi.fn().mockResolvedValue([]),
  getCurrentBranch: vi.fn().mockResolvedValue(null),
  getWorktrees: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: vi.fn().mockResolvedValue({
    path: "/repo",
    isValid: true,
    branch: null,
    headStatus: "unknown",
    hasCommits: true,
    isUnborn: false,
    isDetached: false,
  }),
}));

function renderToolbar() {
  return render(
    <MantineProvider>
      <TopToolbar />
    </MantineProvider>,
  );
}

describe("TopToolbar", () => {
  afterEach(() => {
    cleanup();
    useRepoStore.setState({ tabs: [], activeTabId: null });
    useGitActionsStore.setState({ pendingAction: null, notice: null });
    useWorkspaceUiStore.setState({ pullStrategy: "pull-ff-if-possible" });
  });

  it("shows empty workspace labels and disables repository actions without an active repo", () => {
    renderToolbar();

    expect(screen.getByText("No workspace")).toBeInTheDocument();
    expect(screen.getByText("No branch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Push" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stash" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pop" })).toBeDisabled();
  });
});
