import { describe, expect, it } from "vitest";
import { cloneStagedLinesState } from "./clone-staged-lines-state";
import type { ChangesExplorerStagedLinesState } from "./types";

describe("cloneStagedLinesState", () => {
  it("clones nested line-selection sets without sharing references", () => {
    const original: ChangesExplorerStagedLinesState = {
      "src/file.ts": {
        0: new Set([1, 2]),
        isWholeFileStaged: true,
      },
    };

    const cloned = cloneStagedLinesState(original);

    expect(cloned).toEqual(original);
    expect(cloned["src/file.ts"]).not.toBe(original["src/file.ts"]);
    expect(cloned["src/file.ts"][0]).not.toBe(original["src/file.ts"][0]);
  });
});
