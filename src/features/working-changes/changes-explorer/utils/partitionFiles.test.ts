import { describe, expect, it } from "vitest";
import type { ChangesExplorerFile } from "@/shared/lib/tree/changesExplorerTree";
import { partitionFiles } from "./partitionFiles";

function file(
  path: string,
  status: ChangesExplorerFile["status"],
  withHunks = false,
): ChangesExplorerFile {
  const base = {
    path,
    status,
    insertions: 1,
    deletions: 0,
  };

  return withHunks ? { ...base, hunks: [] } : base;
}

describe("partitionFiles", () => {
  it("splits tracked files from untracked files", () => {
    const sections = partitionFiles(
      [
        file("src/modified.ts", "modified"),
        file("src/new.ts", "added", true),
      ],
      "tracked-untracked",
    );

    expect(sections.map((section) => section.name)).toEqual([
      "Tracked",
      "Untracked",
    ]);
    expect(sections[0].files.map((entry) => entry.path)).toEqual([
      "src/modified.ts",
    ]);
    expect(sections[1].files.map((entry) => entry.path)).toEqual([
      "src/new.ts",
    ]);
  });

  it("keeps all files in a single section when requested", () => {
    const sections = partitionFiles(
      [
        file("src/modified.ts", "modified"),
        file("src/new.ts", "added", true),
      ],
      "single",
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].files.map((entry) => entry.path)).toEqual([
      "src/modified.ts",
      "src/new.ts",
    ]);
  });
});
