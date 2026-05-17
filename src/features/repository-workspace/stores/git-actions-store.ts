import { create } from "zustand";

export type GitActionKind = "pull" | "push" | "stash" | "pop";

export type GitActionNotice = {
  kind: "success" | "error";
  title: string;
  details: string;
  expanded: boolean;
};

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

