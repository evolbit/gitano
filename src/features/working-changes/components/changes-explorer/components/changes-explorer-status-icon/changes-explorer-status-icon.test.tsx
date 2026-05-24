import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChangesExplorerStatusIcon } from "./changes-explorer-status-icon";

describe("ChangesExplorerStatusIcon", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses status-specific colors for modified and deleted files", () => {
    const { container, rerender } = render(
      <ChangesExplorerStatusIcon
        file={{ path: "src/app.ts", status: "modified", insertions: 1, deletions: 1 }}
      />,
    );

    expect(container.firstElementChild?.className).toContain("border-yellow-500");

    rerender(
      <ChangesExplorerStatusIcon
        file={{ path: "src/app.ts", status: "deleted", insertions: 0, deletions: 3 }}
      />,
    );
    expect(container.firstElementChild?.className).toContain("border-red-500");
  });
});
