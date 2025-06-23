import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CommitListItem } from "../types/git";
import { tauriStorage } from "./tauriStorage";

export interface RepoTabState {
  id: string;
  repoPath: string;
  selectedBranch: string | null;
  selectedCommit: CommitListItem | null;
}

interface RepoTabsStore {
  tabs: RepoTabState[];
  activeTabId: string | null;
  addTab: (tab: RepoTabState) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setTabBranch: (id: string, branch: string | null) => void;
  setTabCommit: (id: string, commit: CommitListItem | null) => void;
  updateTab: (id: string, data: Partial<RepoTabState>) => void;
  recentRepos: string[];
  favoriteRepos: string[];
  addRecentRepo: (repo: string) => void;
  removeRepo: (repo: string) => void;
  toggleFavoriteRepo: (repo: string) => void;
}

export const useRepoStore = create<RepoTabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      addTab: (tab) =>
        set((state) => {
          if (state.tabs.some((t) => t.id === tab.id)) return {};
          return { tabs: [...state.tabs, tab] };
        }),
      closeTab: (id) =>
        set((state) => {
          const tabs = state.tabs.filter((t) => t.id !== id);
          let activeTabId = state.activeTabId;
          if (activeTabId === id) {
            activeTabId = tabs.length > 0 ? tabs[0].id : null;
          }
          return { tabs, activeTabId };
        }),
      setActiveTab: (id) => set({ activeTabId: id }),
      setTabBranch: (id, branch) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, selectedBranch: branch } : t
          ),
        })),
      setTabCommit: (id, commit) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, selectedCommit: commit } : t
          ),
        })),
      updateTab: (id, data) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...data } : t)),
        })),
      recentRepos: [],
      favoriteRepos: [],
      addRecentRepo: (repo) => {
        const { recentRepos } = get();
        const newRecentRepos = [
          repo,
          ...recentRepos.filter((r) => r !== repo),
        ].slice(0, 10);
        set({ recentRepos: newRecentRepos });
      },
      removeRepo: (repo) => {
        const { recentRepos, favoriteRepos } = get();
        set({
          recentRepos: recentRepos.filter((r) => r !== repo),
          favoriteRepos: favoriteRepos.filter((r) => r !== repo),
        });
      },
      toggleFavoriteRepo: (repo) => {
        const { favoriteRepos } = get();
        const newFavoriteRepos = favoriteRepos.includes(repo)
          ? favoriteRepos.filter((r) => r !== repo)
          : [...favoriteRepos, repo];
        set({ favoriteRepos: newFavoriteRepos });
      },
    }),
    {
      name: "repo-tabs-storage",
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        recentRepos: state.recentRepos,
        favoriteRepos: state.favoriteRepos,
      }),
    }
  )
);
