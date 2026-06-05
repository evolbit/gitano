import { describe, expect, it } from "vitest";
import { ChangeType } from "@/shared/types/git";
import { createFileChange } from "@/test/fixtures/git";
import { isConflictedFile } from "./is-conflicted-file";

describe("isConflictedFile", () => {
  it("matches only conflicted change rows", () => {
    expect(
      isConflictedFile(createFileChange({ status: ChangeType.Conflicted })),
    ).toBe(true);
    expect(isConflictedFile(createFileChange({ status: ChangeType.Modified }))).toBe(
      false,
    );
  });
});
