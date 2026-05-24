import { describe, expect, it } from "vitest";
import { getFolderExpansionKey } from "./folder-expansion-key";

describe("getFolderExpansionKey", () => {
  it("namespaces folder paths by section", () => {
    expect(getFolderExpansionKey("working", "src/features")).toBe(
      "working:src/features",
    );
  });
});
