import { describe, expect, it } from "vitest";
import { createFileChange, createFileChangeWithHunks } from "@/test/fixtures/git";
import { isUntrackedFile } from "./is-untracked-file";

describe("isUntrackedFile", () => {
  it("identifies added files that include working-tree hunks", () => {
    expect(
      isUntrackedFile(createFileChangeWithHunks({ status: "added" })),
    ).toBe(true);
  });

  it("does not treat flat added commit files as untracked working files", () => {
    expect(isUntrackedFile(createFileChange({ status: "added" }))).toBe(false);
  });
});
