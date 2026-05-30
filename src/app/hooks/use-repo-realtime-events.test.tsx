import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "@/features/repository-workspace";
import { APP_EVENTS } from "@/shared/config/events";
import { useRepoRealtimeEvents } from "./use-repo-realtime-events";
import type { RepoChangedEventPayload } from "@/shared/api/git/realtime";
import type { TauriEvent } from "@/shared/platform/tauri/events";

const syncRepoWatchersMock = vi.hoisted(() => vi.fn());
const listenToEventMock = vi.hoisted(() => vi.fn());
const unlistenMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/realtime", () => ({
  syncRepoWatchers: syncRepoWatchersMock,
}));

vi.mock("@/shared/platform/tauri/events", () => ({
  listenToEvent: listenToEventMock,
}));

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

function RepoRealtimeHarness() {
  useRepoRealtimeEvents();
  return null;
}

describe("useRepoRealtimeEvents", () => {
  let repoChangedHandler:
    | ((event: TauriEvent<RepoChangedEventPayload>) => void)
    | undefined;

  beforeEach(() => {
    repoChangedHandler = undefined;
    syncRepoWatchersMock.mockReset();
    listenToEventMock.mockReset();
    unlistenMock.mockReset();
    listenToEventMock.mockImplementation((_eventName, handler) => {
      repoChangedHandler = handler;
      return Promise.resolve(unlistenMock);
    });
    useRepoStore.setState({
      tabs: [],
      activeTabId: null,
      recentRepos: [],
      favoriteRepos: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("syncs watchers for unique sorted repo paths", () => {
    useRepoStore.setState({
      tabs: [
        {
          id: "repo-b",
          repoPath: "/repo-b",
          selectedBranch: "main",
          selectedCommit: null,
        },
        {
          id: "repo-a",
          repoPath: "/repo-a",
          selectedBranch: "main",
          selectedCommit: null,
        },
        {
          id: "repo-a-duplicate",
          repoPath: "/repo-a",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo-b",
      recentRepos: [],
      favoriteRepos: [],
    });

    render(<RepoRealtimeHarness />);

    expect(syncRepoWatchersMock).toHaveBeenCalledWith(["/repo-a", "/repo-b"]);
    expect(listenToEventMock).toHaveBeenCalledWith(
      APP_EVENTS.repoChanged,
      expect.any(Function),
    );
  });

  it("dispatches refresh events for accepted repo change kinds", () => {
    useRepoStore.setState({
      tabs: [
        {
          id: "repo",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo",
      recentRepos: [],
      favoriteRepos: [],
    });
    const workingChangesRefresh = vi.fn();
    const stashesRefresh = vi.fn();
    const commitsRefresh = vi.fn();
    const repoRefsRefresh = vi.fn();
    window.addEventListener(
      APP_EVENTS.workingChangesRefresh,
      workingChangesRefresh,
    );
    window.addEventListener(APP_EVENTS.stashesRefresh, stashesRefresh);
    window.addEventListener(APP_EVENTS.commitsRefresh, commitsRefresh);
    window.addEventListener(APP_EVENTS.repoRefsRefresh, repoRefsRefresh);

    render(<RepoRealtimeHarness />);
    repoChangedHandler?.({
      payload: {
        repoPath: "/repo",
        kinds: ["working-tree", "stashes", "head", "tags", "config"],
        timestampMs: 1,
      },
    });
    repoChangedHandler?.({
      payload: {
        repoPath: "/other",
        kinds: ["working-tree", "head"],
        timestampMs: 2,
      },
    });

    expect(workingChangesRefresh).toHaveBeenCalledOnce();
    expect(stashesRefresh).toHaveBeenCalledOnce();
    expect(commitsRefresh).toHaveBeenCalledOnce();
    expect(repoRefsRefresh).toHaveBeenCalledOnce();
  });

  it("refreshes commits when remote refs change", () => {
    useRepoStore.setState({
      tabs: [
        {
          id: "repo",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo",
      recentRepos: [],
      favoriteRepos: [],
    });
    const commitsRefresh = vi.fn();
    const repoRefsRefresh = vi.fn();
    window.addEventListener(APP_EVENTS.commitsRefresh, commitsRefresh);
    window.addEventListener(APP_EVENTS.repoRefsRefresh, repoRefsRefresh);

    render(<RepoRealtimeHarness />);
    repoChangedHandler?.({
      payload: {
        repoPath: "/repo",
        kinds: ["remote-refs"],
        timestampMs: 1,
      },
    });

    expect(commitsRefresh).toHaveBeenCalledOnce();
    expect(repoRefsRefresh).toHaveBeenCalledOnce();
  });
});
