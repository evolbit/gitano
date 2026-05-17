import { describe, expect, it } from "vitest";
import { createFileChange } from "@/test/fixtures/git";
import { getFolderCheckboxState } from "./get-folder-checkbox-state";

describe("getFolderCheckboxState", () => {
  const files = [
    createFileChange({ path: "src/a.ts" }),
    createFileChange({ path: "src/b.ts" }),
  ];

  it("returns unchecked for empty folders", () => {
    expect(getFolderCheckboxState([], () => "checked")).toBe("unchecked");
  });

  it("returns checked when every file is checked", () => {
    expect(getFolderCheckboxState(files, () => "checked")).toBe("checked");
  });

  it("returns indeterminate when only some files are checked", () => {
    expect(
      getFolderCheckboxState(files, (file) =>
        file.path.endsWith("a.ts") ? "checked" : "unchecked",
      ),
    ).toBe("indeterminate");
  });
});
