import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace";
import { Launchpad } from "./launchpad";

const getRepositoryStateMock = vi.hoisted(() => vi.fn());
const initLocalRepoDialogMock = vi.hoisted(() => vi.fn());
const openLocalRepoDialogMock = vi.hoisted(() => vi.fn());
const revealPathInFileManagerMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: getRepositoryStateMock,
  initLocalRepoDialog: initLocalRepoDialogMock,
  openLocalRepoDialog: openLocalRepoDialogMock,
}));

vi.mock("@/shared/platform/tauri/opener", () => ({
  revealPathInFileManager: revealPathInFileManagerMock,
}));

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

function renderLaunchpad(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("Launchpad", () => {
  beforeEach(() => {
    getRepositoryStateMock.mockReset();
    initLocalRepoDialogMock.mockReset();
    openLocalRepoDialogMock.mockReset();
    revealPathInFileManagerMock.mockReset();
    useRepoStore.setState({
      tabs: [],
      activeTabId: null,
      recentRepos: [],
      favoriteRepos: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows unborn repositories as valid recent repositories", async () => {
    useRepoStore.setState({
      recentRepos: ["/work/empty-repo"],
      favoriteRepos: [],
    });
    getRepositoryStateMock.mockResolvedValueOnce({
      path: "/work/empty-repo",
      isValid: true,
      branch: "main",
      headStatus: "unborn",
      hasCommits: false,
      isUnborn: true,
      isDetached: false,
    });

    renderLaunchpad(<Launchpad />);

    expect(await screen.findByText("empty-repo")).toBeInTheDocument();
    expect(screen.getByText("main - no commits")).toBeInTheDocument();
    expect(screen.queryByText("Error")).not.toBeInTheDocument();
  });

  it("opens a browsed unborn repository and adds it to recents", async () => {
    const onRepoOpened = vi.fn();
    openLocalRepoDialogMock.mockResolvedValueOnce("/work/empty-repo");

    renderLaunchpad(<Launchpad onRepoOpened={onRepoOpened} />);

    screen.getByRole("button", { name: "Browse" }).click();

    await waitFor(() => {
      expect(onRepoOpened).toHaveBeenCalledWith("/work/empty-repo");
    });
    expect(useRepoStore.getState().recentRepos[0]).toBe("/work/empty-repo");
  });

  it("creates a local repository and opens it from launchpad", async () => {
    const onRepoOpened = vi.fn();
    initLocalRepoDialogMock.mockResolvedValueOnce("/work/new-repo");

    renderLaunchpad(<Launchpad onRepoOpened={onRepoOpened} />);

    screen.getByRole("button", { name: "New Repository" }).click();

    await waitFor(() => {
      expect(onRepoOpened).toHaveBeenCalledWith("/work/new-repo");
    });
    expect(useRepoStore.getState().recentRepos[0]).toBe("/work/new-repo");
  });
});
