import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoStore } from "./repo-store";

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe("repo store", () => {
  beforeEach(() => {
    useRepoStore.setState({
      tabs: [],
      activeTabId: null,
      recentRepos: [],
      favoriteRepos: [],
    });
  });

  it("adds tabs once and closes the active tab by selecting the first remaining tab", () => {
    const firstTab = {
      id: "repo-1",
      repoPath: "/repo-one",
      selectedBranch: "main",
      selectedCommit: null,
    };
    const secondTab = {
      id: "repo-2",
      repoPath: "/repo-two",
      selectedBranch: "feature/a",
      selectedCommit: null,
    };

    useRepoStore.getState().addTab(firstTab);
    useRepoStore.getState().addTab(firstTab);
    useRepoStore.getState().addTab(secondTab);
    useRepoStore.getState().setActiveTab("repo-2");
    useRepoStore.getState().closeTab("repo-2");

    expect(useRepoStore.getState().tabs).toEqual([firstTab]);
    expect(useRepoStore.getState().activeTabId).toBe("repo-1");
  });

  it("deduplicates recent repos and caps the list at ten entries", () => {
    Array.from({ length: 11 }, (_, index) => `/repo-${index}`).forEach((repo) => {
      useRepoStore.getState().addRecentRepo(repo);
    });
    useRepoStore.getState().addRecentRepo("/repo-4");

    expect(useRepoStore.getState().recentRepos).toHaveLength(10);
    expect(useRepoStore.getState().recentRepos[0]).toBe("/repo-4");
    expect(new Set(useRepoStore.getState().recentRepos).size).toBe(10);
  });

  it("removes repos from both recent and favorite lists", () => {
    useRepoStore.getState().addRecentRepo("/repo");
    useRepoStore.getState().toggleFavoriteRepo("/repo");

    useRepoStore.getState().removeRepo("/repo");

    expect(useRepoStore.getState().recentRepos).toEqual([]);
    expect(useRepoStore.getState().favoriteRepos).toEqual([]);
  });
});

