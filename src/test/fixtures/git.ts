import type {
  DiffHunk,
  DiffLine,
  FileChange,
  FileChangeWithHunks,
  StagedFileSelectionState,
} from "@/shared/types/git";

export function createDiffLine(overrides: Partial<DiffLine> = {}): DiffLine {
  return {
    kind: "Context",
    content: "same",
    old_lineno: 1,
    new_lineno: 1,
    ...overrides,
  };
}

export function createDiffHunk(overrides: Partial<DiffHunk> = {}): DiffHunk {
  return {
    header: "@@ -1,3 +1,3 @@",
    old_start: 1,
    old_lines: 3,
    new_start: 1,
    new_lines: 3,
    is_new_file: false,
    lines: [
      createDiffLine({ content: "same", old_lineno: 1, new_lineno: 1 }),
      createDiffLine({
        kind: "Del",
        content: "old",
        old_lineno: 2,
        new_lineno: null,
      }),
      createDiffLine({
        kind: "Add",
        content: "new",
        old_lineno: null,
        new_lineno: 2,
      }),
    ],
    ...overrides,
  };
}

export function createFileChange(
  overrides: Partial<FileChange> = {},
): FileChange {
  return {
    path: "src/file.ts",
    status: "modified",
    insertions: 1,
    deletions: 1,
    ...overrides,
  };
}

export function createFileChangeWithHunks(
  overrides: Partial<FileChangeWithHunks> = {},
): FileChangeWithHunks {
  return {
    ...createFileChange(overrides),
    hunks: [createDiffHunk()],
    ...overrides,
  };
}

export function createStagedSelection(
  overrides: Partial<StagedFileSelectionState> = {},
): StagedFileSelectionState {
  return {
    hunks: {},
    ...overrides,
  };
}
