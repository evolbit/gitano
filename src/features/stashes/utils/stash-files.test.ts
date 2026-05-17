import { describe, expect, it } from "vitest";
import { toChangesExplorerFile, toSelectedStashFileSet } from "./stash-files";

describe("stash file utilities", () => {
  it("normalizes backend typechanged statuses for the changes explorer", () => {
    expect(
      toChangesExplorerFile({
        path: "src/file.ts",
        status: "typechanged",
        insertions: 3,
        deletions: 1,
      }),
    ).toEqual({
      path: "src/file.ts",
      status: "typeChanged",
      insertions: 3,
      deletions: 1,
    });
  });

  it("builds the selected file set from stash files", () => {
    const selected = toSelectedStashFileSet([
      {
        path: "src/a.ts",
        status: "modified",
        insertions: 1,
        deletions: 0,
      },
      {
        path: "src/b.ts",
        status: "added",
        insertions: 4,
        deletions: 0,
      },
    ]);

    expect(Array.from(selected)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

