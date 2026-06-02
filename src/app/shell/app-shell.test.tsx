import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace";
import { AppShell } from "./app-shell";
import type { TauriEvent } from "@/shared/platform/tauri/events";

const listenToEventMock = vi.hoisted(() => vi.fn());
const unlistenMock = vi.hoisted(() => vi.fn());
const getLicenseStatusMock = vi.hoisted(() => vi.fn());
const refreshLicenseValidationMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/hooks/use-repo-realtime-events", () => ({
  useRepoRealtimeEvents: vi.fn(),
}));

vi.mock("@/app/hooks/use-active-repo-remote-polling", () => ({
  useActiveRepoRemotePolling: vi.fn(),
}));

vi.mock("@/shared/platform/tauri/events", () => ({
  listenToEvent: listenToEventMock,
}));

vi.mock("@/shared/api/license", () => ({
  getLicenseStatus: getLicenseStatusMock,
  refreshLicenseValidation: refreshLicenseValidationMock,
}));

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock("@/features/settings", () => ({
  SettingsWindow: ({
    open,
    repoPath,
  }: {
    open: boolean;
    repoPath: string | null;
  }) => (open ? <div>Settings for {repoPath ?? "none"}</div> : null),
}));

vi.mock("@/features/license", () => ({
  LicenseWindow: ({
    open,
  }: {
    open: boolean;
    onClose: () => void;
  }) => (open ? <div>License window</div> : null),
}));

vi.mock("@/features/repository-workspace", async () => {
  const actual = await vi.importActual<typeof import("@/features/repository-workspace")>(
    "@/features/repository-workspace",
  );

  return {
    ...actual,
    RepoTabLayout: () => <div>Repo workspace</div>,
    TabBar: ({
      tabs,
      onAddTab,
      onOpenLicense,
      onOpenSettings,
      onTabClose,
    }: {
      tabs: Array<{ id: string; repoPath: string }>;
      onAddTab: () => void;
      onOpenLicense: () => void;
      onOpenSettings: () => void;
      onTabClose: (id: string, event: React.MouseEvent) => void;
    }) => (
      <div>
        <span data-testid="tab-count">{tabs.length}</span>
        <button
          type="button"
          onClick={onAddTab}>
          Add tab
        </button>
        <button
          type="button"
          onClick={onOpenLicense}>
          License
        </button>
        <button
          type="button"
          onClick={onOpenSettings}>
          Settings
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={(event) => onTabClose(tab.id, event)}>
            Close {tab.id}
          </button>
        ))}
      </div>
    ),
  };
});

vi.mock("./home-page/home-page", () => ({
  default: ({ onRepoOpened }: { onRepoOpened?: (path: string) => void }) => (
    <button
      type="button"
      onClick={() => onRepoOpened?.("/repo/project")}>
      Open repo
    </button>
  ),
}));

function renderAppShell() {
  return render(
    <MantineProvider>
      <AppShell />
    </MantineProvider>,
  );
}

describe("AppShell", () => {
  let menuEventHandler: ((event: TauriEvent<string>) => void) | undefined;
  let dateNowMock: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    menuEventHandler = undefined;
    listenToEventMock.mockReset();
    unlistenMock.mockReset();
    listenToEventMock.mockImplementation((_eventName, handler) => {
      menuEventHandler = handler;
      return Promise.resolve(unlistenMock);
    });
    getLicenseStatusMock.mockResolvedValue({ licenseId: null });
    refreshLicenseValidationMock.mockResolvedValue({});
    dateNowMock = vi.spyOn(Date, "now").mockReturnValue(123);
    useRepoStore.setState({
      tabs: [],
      activeTabId: null,
      recentRepos: [],
      favoriteRepos: [],
    });
  });

  afterEach(() => {
    cleanup();
    dateNowMock?.mockRestore();
    vi.clearAllMocks();
  });

  it("creates the home tab and opens a repository in a new active tab", async () => {
    renderAppShell();

    await fireEvent.click(await screen.findByRole("button", { name: "Open repo" }));

    await waitFor(() => {
      expect(useRepoStore.getState().tabs).toEqual([
        {
          id: "home",
          label: "",
          repoPath: "",
          selectedBranch: null,
          selectedCommit: null,
        },
        {
          id: "repo-project-123",
          repoPath: "/repo/project",
          selectedBranch: null,
          selectedCommit: null,
        },
      ]);
    });
    expect(useRepoStore.getState().activeTabId).toBe("repo-project-123");
    expect(useRepoStore.getState().recentRepos).toEqual(["/repo/project"]);
  });

  it("handles close-tab menu events through the platform event adapter", async () => {
    useRepoStore.setState({
      tabs: [
        {
          id: "home",
          repoPath: "",
          selectedBranch: null,
          selectedCommit: null,
        },
        {
          id: "repo",
          repoPath: "/repo",
          selectedBranch: null,
          selectedCommit: null,
        },
      ],
      activeTabId: "repo",
      recentRepos: [],
      favoriteRepos: [],
    });

    const { unmount } = renderAppShell();

    await waitFor(() => {
      expect(listenToEventMock).toHaveBeenCalledWith("menu-event", expect.any(Function));
    });
    menuEventHandler?.({ payload: "close_tab" });

    expect(useRepoStore.getState().tabs.map((tab) => tab.id)).toEqual(["home"]);
    expect(useRepoStore.getState().activeTabId).toBe("home");

    unmount();
    await waitFor(() => expect(unlistenMock).toHaveBeenCalledOnce());
  });

  it("opens license management from the application tab bar", async () => {
    renderAppShell();

    fireEvent.click(await screen.findByRole("button", { name: "License" }));

    expect(await screen.findByText("License window")).toBeInTheDocument();
  });

  it("refreshes imported licenses in the background", async () => {
    getLicenseStatusMock.mockResolvedValue({ licenseId: "lic_123" });

    renderAppShell();

    await waitFor(() => {
      expect(refreshLicenseValidationMock).toHaveBeenCalledWith({ force: false });
    });
  });
});
