import { create } from "zustand";

export type StagedLinesState = {
  stagedLines: {
    [filePath: string]: {
      [hunkIdx: number]: Set<number>;
      isNewFile?: boolean;
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
  setStagedNewFile: (filePath: string, value: boolean) => void;
  isStagedNewFile: (filePath: string) => boolean;
};

export const useStagedLinesStore = create<StagedLinesState>((set, get) => ({
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
  setStagedNewFile: (filePath, value) =>
    set((state) => {
      if (value) {
        return {
          stagedLines: {
            ...state.stagedLines,
            [filePath]: { isNewFile: true },
          },
        };
      } else {
        const prev = state.stagedLines[filePath] || {};
        // If only isNewFile is present, remove the whole entry; otherwise remove only that flag
        const { isNewFile, ...rest } = prev;
        if (Object.keys(rest).length === 0) {
          const newStaged = { ...state.stagedLines };
          delete newStaged[filePath];
          return { stagedLines: newStaged };
        } else {
          return {
            stagedLines: {
              ...state.stagedLines,
              [filePath]: rest,
            },
          };
        }
      }
    }),
  isStagedNewFile: (filePath) => {
    return !!get().stagedLines[filePath]?.isNewFile;
  },
}));
