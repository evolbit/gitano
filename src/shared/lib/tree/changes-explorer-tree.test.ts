import { describe, expect, it } from "vitest";
import type { DiffHunk, FileChange, FileChangeWithHunks } from "@/shared/types/git";
import {
  buildAllStageableLineMap,
  buildCompressedTree,
  collectFilesFromTree,
  collectFolderPaths,
} from "./changes-explorer-tree";

function file(path: string): FileChange {
  return {
    path,
    status: "modified",
    insertions: 1,
    deletions: 1,
  };
}

describe("changes explorer tree helpers", () => {
  it("builds compressed folder trees with folders before files", () => {
    const files = [
      file("README.md"),
      file("src/shared/ui/button.tsx"),
      file("src/shared/ui/input.tsx"),
      file("docs/guides/install.md"),
    ];

    const tree = buildCompressedTree(files);

    expect(tree.map((node) => node.name)).toEqual([
      "docs/guides",
      "src/shared/ui",
      "README.md",
    ]);
    expect(Array.from(collectFolderPaths(tree))).toEqual([
      "docs/guides",
      "src/shared/ui",
    ]);
    expect(collectFilesFromTree(tree).map((entry) => entry.path)).toEqual([
      "docs/guides/install.md",
      "src/shared/ui/button.tsx",
      "src/shared/ui/input.tsx",
      "README.md",
    ]);
  });

  it("builds a map of stageable add and delete line indexes", () => {
    const hunk: DiffHunk = {
      header: "@@ -1,2 +1,2 @@",
      old_start: 1,
      old_lines: 2,
      new_start: 1,
      new_lines: 2,
      is_new_file: false,
      lines: [
        { kind: "Context", content: "same", old_lineno: 1, new_lineno: 1 },
        { kind: "Del", content: "old", old_lineno: 2, new_lineno: null },
        { kind: "Add", content: "new", old_lineno: null, new_lineno: 2 },
      ],
    };
    const changedFile: FileChangeWithHunks = {
      ...file("src/file.ts"),
      hunks: [hunk],
    };

    expect(buildAllStageableLineMap(changedFile)).toEqual({ 0: [1, 2] });
    expect(buildAllStageableLineMap(file("src/file.ts"))).toEqual({});
  });
});
