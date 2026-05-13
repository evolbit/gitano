import { create } from "zustand";
import { GitActionNotice } from "../components/top-toolbar/types";

type GitActionKind = "pull" | "push" | "stash" | "pop";

interface GitActionsStore {
  pendingAction: GitActionKind | null;
  notice: GitActionNotice | null;
  setPendingAction: (pendingAction: GitActionKind | null) => void;
  setNotice: (notice: GitActionNotice | null) => void;
}

export const useGitActionsStore = create<GitActionsStore>((set) => ({
  pendingAction: null,
  notice: null,
  setPendingAction: (pendingAction) => set({ pendingAction }),
  setNotice: (notice) => set({ notice }),
}));
