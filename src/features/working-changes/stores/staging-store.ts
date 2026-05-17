import { create } from "zustand";

export type StagedLinesState = {
  stagedLines: {
    [filePath: string]: {
      [hunkIdx: number]: Set<number>;
      isNewFile?: boolean;
      isWholeFileStaged?: boolean;
    };
  };
  setStagedLines: (
    filePath: string,
    hunkIdx: number,
    lines: Set<number>,
  ) => void;
  setAllStagedLinesForFile: (
    filePath: string,
    hunks: { [hunkIdx: number]: number[] },
  ) => void;
  setLineSelectionForFile: (
    filePath: string,
    selection: { [hunkIdx: number]: Set<number> },
  ) => void;
  clearStagedLinesForFile: (filePath: string) => void;
  clearAllStagedLines: () => void;
  replaceStagedLines: (
    stagedLines: StagedLinesState["stagedLines"],
  ) => void;
  setStagedNewFile: (filePath: string, value: boolean) => void;
  isStagedNewFile: (filePath: string) => boolean;
  setWholeFileStaged: (filePath: string, value: boolean) => void;
  isWholeFileStaged: (filePath: string) => boolean;
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
          ]),
        ) as { [hunkIdx: number]: Set<number> },
      },
    })),
  setLineSelectionForFile: (filePath, selection) =>
    set((state) => {
      const prev = state.stagedLines[filePath] || {};
      const next: {
        [hunkIdx: number]: Set<number>;
        isNewFile?: boolean;
        isWholeFileStaged?: boolean;
      } = {};

      if (prev.isNewFile) {
        next.isNewFile = true;
      }
      if (prev.isWholeFileStaged) {
        next.isWholeFileStaged = true;
      }

      Object.entries(selection).forEach(([hunkIdx, lines]) => {
        next[Number(hunkIdx)] = new Set(lines);
      });

      return {
        stagedLines: {
          ...state.stagedLines,
          [filePath]: next,
        },
      };
    }),
  clearStagedLinesForFile: (filePath) =>
    set((state) => {
      const newStaged = { ...state.stagedLines };
      delete newStaged[filePath];
      return { stagedLines: newStaged };
    }),
  clearAllStagedLines: () => set({ stagedLines: {} }),
  replaceStagedLines: (stagedLines) => set({ stagedLines }),
  setStagedNewFile: (filePath, value) =>
    set((state) => {
      if (value) {
        return {
          stagedLines: {
            ...state.stagedLines,
            [filePath]: { isNewFile: true },
          },
        };
      }

      const prev = state.stagedLines[filePath] || {};
      const { isNewFile, ...rest } = prev;
      if (Object.keys(rest).length === 0) {
        const newStaged = { ...state.stagedLines };
        delete newStaged[filePath];
        return { stagedLines: newStaged };
      }

      return {
        stagedLines: {
          ...state.stagedLines,
          [filePath]: rest,
        },
      };
    }),
  isStagedNewFile: (filePath) => {
    return !!get().stagedLines[filePath]?.isNewFile;
  },
  setWholeFileStaged: (filePath, value) =>
    set((state) => {
      if (value) {
        return {
          stagedLines: {
            ...state.stagedLines,
            [filePath]: {
              ...(state.stagedLines[filePath] || {}),
              isWholeFileStaged: true,
            },
          },
        };
      }

      const prev = state.stagedLines[filePath] || {};
      const { isWholeFileStaged, ...rest } = prev;
      const hasLineSelections = Object.keys(rest).some(
        (key) =>
          key !== "isNewFile" && rest[key as unknown as number] instanceof Set,
      );

      if (!prev.isNewFile && !hasLineSelections) {
        const next = { ...state.stagedLines };
        delete next[filePath];
        return { stagedLines: next };
      }

      return {
        stagedLines: {
          ...state.stagedLines,
          [filePath]: rest,
        },
      };
    }),
  isWholeFileStaged: (filePath) =>
    !!get().stagedLines[filePath]?.isWholeFileStaged,
}));

