import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { tauriStorage } from "./tauriStorage";

interface RepoState {
  recentRepos: string[];
  favoriteRepos: string[];
  addRecentRepo: (repo: string) => void;
  removeRepo: (repo: string) => void;
  toggleFavoriteRepo: (repo: string) => void;
  currentRepo: string | null;
  setCurrentRepo: (repo: string | null) => void;
  selectedBranch: string | null;
  setSelectedBranch: (branch: string | null) => void;
}

export const useRepoStore = create<RepoState>()(
  persist(
    (set, get) => ({
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
      currentRepo: null,
      setCurrentRepo: (repo) => {
        if (repo) {
          get().addRecentRepo(repo);
        }
        set({ currentRepo: repo });
      },
      selectedBranch: null,
      setSelectedBranch: (branch) => set({ selectedBranch: branch }),
    }),
    {
      name: "repo-storage",
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        recentRepos: state.recentRepos,
        favoriteRepos: state.favoriteRepos,
      }),
    }
  )
);
