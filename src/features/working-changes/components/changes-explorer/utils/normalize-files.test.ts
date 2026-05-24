import { describe, expect, it } from "vitest";
import { normalizeFiles } from "./normalize-files";

describe("normalizeFiles", () => {
  it("normalizes unknown statuses while preserving the rest of each file", () => {
    expect(
      normalizeFiles([
        {
          path: "src/file.ts",
          status: "unexpected" as never,
          insertions: 1,
          deletions: 2,
        },
      ]),
    ).toEqual([
      {
        path: "src/file.ts",
        status: "modified",
        insertions: 1,
        deletions: 2,
      },
    ]);
  });
});
