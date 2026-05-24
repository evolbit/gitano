import { describe, expect, it } from "vitest";
import { getAncestorFolderPaths, getFileName, getParentPath } from "./";

describe("path helpers", () => {
  it("extracts the file name from slash-delimited paths", () => {
    expect(getFileName("src/shared/components/button/button.tsx")).toBe(
      "button.tsx",
    );
    expect(getFileName("README.md")).toBe("README.md");
  });

  it("extracts the parent path from slash-delimited paths", () => {
    expect(getParentPath("src/shared/components/button/button.tsx")).toBe(
      "src/shared/components/button",
    );
    expect(getParentPath("README.md")).toBe("");
  });

  it("enumerates ancestor folder paths in order", () => {
    expect(
      getAncestorFolderPaths("src/shared/components/button/button.tsx"),
    ).toEqual([
      "src",
      "src/shared",
      "src/shared/components",
      "src/shared/components/button",
    ]);
  });
});
