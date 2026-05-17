import { describe, expect, it } from "vitest";
import { createFileChange } from "@/test/fixtures/git";
import { getTreeDescendants } from "./get-tree-descendants";
import type { ChangesExplorerTreeNode } from "@/shared/lib/tree/changes-explorer-tree";

describe("getTreeDescendants", () => {
  it("collects files from nested folder nodes", () => {
    const first = createFileChange({ path: "src/a.ts" });
    const second = createFileChange({ path: "src/nested/b.ts" });
    const node: ChangesExplorerTreeNode = {
      kind: "folder",
      name: "src",
      path: "src",
      children: [
        { kind: "file", name: "a.ts", path: first.path, file: first },
        {
          kind: "folder",
          name: "nested",
          path: "src/nested",
          children: [
            { kind: "file", name: "b.ts", path: second.path, file: second },
          ],
        },
      ],
    };

    expect(getTreeDescendants(node)).toEqual([first, second]);
  });
});
