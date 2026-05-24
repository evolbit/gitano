import { describe, expect, it } from "vitest";
import { createFileChange } from "@/test/fixtures/git";
import { fileMatchesSearch } from "./file-matches-search";

describe("fileMatchesSearch", () => {
  it("matches paths case-insensitively", () => {
    expect(
      fileMatchesSearch(createFileChange({ path: "Src/Feature/File.ts" }), "feature/file"),
    ).toBe(true);
  });

  it("matches every file when the query is empty", () => {
    expect(fileMatchesSearch(createFileChange(), "")).toBe(true);
  });
});
