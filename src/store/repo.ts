import { create } from "zustand";

interface RepoState {
  currentRepo: string | null;
  setCurrentRepo: (repo: string | null) => void;
  selectedBranch: string | null;
  setSelectedBranch: (branch: string | null) => void;
}

export const useRepoStore = create<RepoState>((set) => ({
  currentRepo: null,
  setCurrentRepo: (repo) => set({ currentRepo: repo }),
  selectedBranch: null,
  setSelectedBranch: (branch) => set({ selectedBranch: branch }),
}));
