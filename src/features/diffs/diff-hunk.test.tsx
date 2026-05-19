import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiffHunk, createDiffLine } from "@/test/fixtures/git";
import DiffHunk from "./diff-hunk";

const longLine =
  "The system SHALL render a long diff line without soft wrapping so line numbers keep a compact vertical rhythm.";

function renderHunk(displayMode: "unified" | "split" = "unified") {
  render(
    <DiffHunk
      hunk={createDiffHunk({
        lines: [
          createDiffLine({
            kind: "Add",
            content: longLine,
            old_lineno: null,
            new_lineno: 5,
          }),
        ],
      })}
      filePath="openspec/spec.md"
      hunkIdx={0}
      isHovered={false}
      setHoveredHunkIdx={vi.fn()}
      displayMode={displayMode}
    />,
  );
}

describe("DiffHunk", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps unified diff lines from soft wrapping", () => {
    renderHunk("unified");

    expect(screen.getByText(longLine)).toHaveClass("whitespace-pre");
    expect(screen.getByText(longLine)).not.toHaveClass("whitespace-pre-wrap");
  });

  it("keeps split diff cells from soft wrapping", () => {
    const { container } = render(
      <DiffHunk
        hunk={createDiffHunk({
          lines: [
            createDiffLine({
              kind: "Context",
              content: longLine,
              old_lineno: 5,
              new_lineno: 5,
            }),
          ],
        })}
        filePath="openspec/spec.md"
        hunkIdx={0}
        isHovered={false}
        setHoveredHunkIdx={vi.fn()}
        displayMode="split"
      />,
    );

    expect(container.querySelector(".whitespace-pre")).toBeInTheDocument();
    expect(
      container.querySelector(".whitespace-pre-wrap"),
    ).not.toBeInTheDocument();
  });
});
