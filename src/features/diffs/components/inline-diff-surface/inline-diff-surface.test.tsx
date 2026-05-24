import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InlineDiffSurface from "./inline-diff-surface";

vi.mock("../diff-viewer/diff-viewer", () => ({
  default: ({ filePath, onDisplayModeChange }: { filePath: string; onDisplayModeChange?: (mode: "split") => void }) => (
    <button type="button" onClick={() => onDisplayModeChange?.("split")}>Viewing {filePath}</button>
  ),
}));

describe("InlineDiffSurface", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the selected file title and closes from button or Escape", () => {
    const onClose = vi.fn();

    render(
      <InlineDiffSurface
        repoPath="/repo"
        filePath="src/app.ts"
        title="src/app.ts"
        onClose={onClose}
      />,
    );

    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Viewing src/app.ts" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close diff viewer" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
