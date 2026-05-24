import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiffViewerBase from "./diff-viewer-base";

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
});
