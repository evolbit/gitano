import { create } from "zustand";
import { DiffHunk } from "../types/git";

interface FileHunksState {
  filePath: string | null;
  hunks: DiffHunk[];
  setFileHunks: (filePath: string, hunks: DiffHunk[]) => void;
  clearFileHunks: () => void;
}

export const useFileHunksStore = create<FileHunksState>((set) => ({
  filePath: null,
  hunks: [],
  setFileHunks: (filePath, hunks) => set({ filePath, hunks }),
  clearFileHunks: () => set({ filePath: null, hunks: [] }),
}));
