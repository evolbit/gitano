import { describe, expect, it } from "vitest";
import {
  createDiffHunk,
  createFileChange,
  createFileChangeWithHunks,
} from "@/test/fixtures/git";
import { isUntrackedFile } from "./is-untracked-file";

describe("isUntrackedFile", () => {
  it("identifies added files that include working-tree hunks", () => {
    expect(
      isUntrackedFile(
        createFileChangeWithHunks({
          status: "added",
          hunks: [createDiffHunk({ is_new_file: true })],
        }),
      ),
    ).toBe(true);
  });

  it("does not treat flat added commit files as untracked working files", () => {
    expect(isUntrackedFile(createFileChange({ status: "added" }))).toBe(false);
  });
});
