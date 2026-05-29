import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiffHunk } from "../../types";
import DiffViewerBase, {
  getBoundedDiffHunks,
} from "./diff-viewer-base";

function createHunk(lineCount: number): DiffHunk {
  return {
    header: "@@ -1,1 +1,1 @@",
    old_start: 1,
    old_lines: lineCount,
    new_start: 1,
    new_lines: lineCount,
    is_new_file: false,
    lines: Array.from({ length: lineCount }, (_, index) => ({
      kind: "Context",
      content: `line ${index}`,
      old_lineno: index + 1,
      new_lineno: index + 1,
    })),
  };
}

describe("DiffViewerBase", () => {
  afterEach(() => {
    cleanup();
  });

  it("surfaces loading, error, empty, and display-mode actions", () => {
    const onDisplayModeChange = vi.fn();
    const { rerender } = render(
      <DiffViewerBase
        filePath="src/app.ts"
        hunks={[]}
        loading
        displayMode="unified"
        onDisplayModeChange={onDisplayModeChange}
      />,
    );

    expect(screen.getByText("Loading diff...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(onDisplayModeChange).toHaveBeenCalledWith("split");

    rerender(<DiffViewerBase filePath="src/app.ts" hunks={[]} error="Diff failed" />);
    expect(screen.getByText("Diff failed")).toBeInTheDocument();

    rerender(<DiffViewerBase filePath="src/app.ts" hunks={[]} />);
    expect(screen.getByText("No changes.")).toBeInTheDocument();
  });

  it("bounds rendered diff lines while preserving hunk indexes", () => {
    const first = createHunk(3);
    const second = createHunk(3);

    const bounded = getBoundedDiffHunks([first, second], 4);

    expect(bounded.hiddenLineCount).toBe(2);
    expect(bounded.visibleHunks).toHaveLength(2);
    expect(bounded.visibleHunks[0]).toBe(first);
    expect(bounded.visibleHunks[1].lines).toHaveLength(1);
  });
});
