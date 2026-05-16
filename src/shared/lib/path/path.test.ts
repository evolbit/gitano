import { describe, expect, it } from "vitest";
import { getAncestorFolderPaths, getFileName, getParentPath } from ".";

describe("path helpers", () => {
  it("extracts the file name from slash-delimited paths", () => {
    expect(getFileName("src/components/ChangesExplorer.tsx")).toBe(
      "ChangesExplorer.tsx",
    );
    expect(getFileName("README.md")).toBe("README.md");
  });

  it("extracts the parent path from slash-delimited paths", () => {
    expect(getParentPath("src/components/ChangesExplorer.tsx")).toBe(
      "src/components",
    );
    expect(getParentPath("README.md")).toBe("");
  });

  it("enumerates ancestor folder paths in order", () => {
    expect(getAncestorFolderPaths("src/components/ChangesExplorer.tsx")).toEqual(
      ["src", "src/components"],
    );
  });
});
