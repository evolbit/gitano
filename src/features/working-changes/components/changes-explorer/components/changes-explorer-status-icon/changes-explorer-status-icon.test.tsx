import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChangeType } from "@/shared/types/git";
import { ChangesExplorerStatusIcon } from "./changes-explorer-status-icon";

describe("ChangesExplorerStatusIcon", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses status-specific colors for modified and deleted files", () => {
    const { container, rerender } = render(
      <ChangesExplorerStatusIcon
        file={{
          path: "src/app.ts",
          status: ChangeType.Modified,
          insertions: 1,
          deletions: 1,
        }}
      />,
    );

    expect(container.firstElementChild?.className).toContain("border-yellow-500");

    rerender(
      <ChangesExplorerStatusIcon
        file={{
          path: "src/app.ts",
          status: ChangeType.Deleted,
          insertions: 0,
          deletions: 3,
        }}
      />,
    );
    expect(container.firstElementChild?.className).toContain("border-red-500");
  });

  it("uses the conflict color for conflicted files", () => {
    const { container } = render(
      <ChangesExplorerStatusIcon
        file={{
          path: "src/app.ts",
          status: ChangeType.Conflicted,
          insertions: 0,
          deletions: 0,
        }}
      />,
    );

    expect(container.firstElementChild?.className).toContain("border-amber-400");
  });
});
