import { create } from "zustand";

export type StagedLinesState = {
  stagedLines: {
    [filePath: string]: {
      [hunkIdx: number]: Set<number>;
    };
  };
  setStagedLines: (
    filePath: string,
    hunkIdx: number,
    lines: Set<number>
  ) => void;
  setAllStagedLinesForFile: (
    filePath: string,
    hunks: { [hunkIdx: number]: number[] }
  ) => void;
  clearStagedLinesForFile: (filePath: string) => void;
  clearAllStagedLines: () => void;
};

export const useStagedLinesStore = create<StagedLinesState>((set) => ({
  stagedLines: {},
  setStagedLines: (filePath, hunkIdx, lines) =>
    set((state) => ({
      stagedLines: {
        ...state.stagedLines,
        [filePath]: {
          ...(state.stagedLines[filePath] || {}),
          [hunkIdx]: new Set(lines),
        },
      },
    })),
  setAllStagedLinesForFile: (filePath, hunks) =>
    set((state) => ({
      stagedLines: {
        ...state.stagedLines,
        [filePath]: Object.fromEntries(
          Object.entries(hunks).map(([hunkIdx, lineIdxs]) => [
            Number(hunkIdx),
            new Set(lineIdxs),
          ])
        ),
      },
    })),
  clearStagedLinesForFile: (filePath) =>
    set((state) => {
      const newStaged = { ...state.stagedLines };
      delete newStaged[filePath];
      return { stagedLines: newStaged };
    }),
  clearAllStagedLines: () => set({ stagedLines: {} }),
}));
