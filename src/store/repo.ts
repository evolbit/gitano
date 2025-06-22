import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { tauriStorage } from "./tauriStorage";

interface RepoState {
  recentRepos: string[];
  addRecentRepo: (repo: string) => void;
  currentRepo: string | null;
  setCurrentRepo: (repo: string | null) => void;
  selectedBranch: string | null;
  setSelectedBranch: (branch: string | null) => void;
}

export const useRepoStore = create<RepoState>()(
  persist(
    (set, get) => ({
      recentRepos: [],
      addRecentRepo: (repo) => {
        const { recentRepos } = get();
        const newRecentRepos = [
          repo,
          ...recentRepos.filter((r) => r !== repo),
        ].slice(0, 10);
        set({ recentRepos: newRecentRepos });
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
      partialize: (state) => ({ recentRepos: state.recentRepos }),
    }
  )
);
