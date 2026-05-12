import { create } from "zustand";
import { RemoteNotice } from "../components/top-toolbar/types";

type RemoteActionKind = "pull" | "push";

interface RemoteActionsStore {
  pending: RemoteActionKind | null;
  notice: RemoteNotice | null;
  setPending: (pending: RemoteActionKind | null) => void;
  setNotice: (notice: RemoteNotice | null) => void;
}

export const useRemoteActionsStore = create<RemoteActionsStore>((set) => ({
  pending: null,
  notice: null,
  setPending: (pending) => set({ pending }),
  setNotice: (notice) => set({ notice }),
}));
