import { beforeEach, describe, expect, it } from "vitest";
import type { DiffHunk } from "@/shared/types/git";
import { useFileHunksStore } from "./file-hunks-store";

describe("file hunks store", () => {
  beforeEach(() => {
    useFileHunksStore.getState().clearFileHunks();
  });

  it("stores and clears the active file hunk set", () => {
    const hunks: DiffHunk[] = [
      {
        header: "@@ -1 +1 @@",
        old_start: 1,
        old_lines: 1,
        new_start: 1,
        new_lines: 1,
        lines: [],
        is_new_file: false,
      },
    ];

    useFileHunksStore.getState().setFileHunks("src/file.ts", hunks);

    expect(useFileHunksStore.getState()).toMatchObject({
      filePath: "src/file.ts",
      hunks,
    });

    useFileHunksStore.getState().clearFileHunks();

    expect(useFileHunksStore.getState()).toMatchObject({
      filePath: null,
      hunks: [],
    });
  });
});

