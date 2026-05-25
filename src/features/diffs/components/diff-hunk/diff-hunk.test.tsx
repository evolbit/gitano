import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiffHunk, createDiffLine } from "@/test/fixtures/git";
import DiffHunk from "./diff-hunk";

const longLine =
  "The system SHALL render a long diff line with wrapping so line numbers keep a compact vertical rhythm.";
const longToken =
  "thisIsAnIntentionallyLongUnbrokenTokenUsedToVerifyDiffWrappingDoesNotForceHorizontalOverflowAcrossTheVisiblePane";

function expectWrappedSource(element: HTMLElement) {
  expect(element).toHaveClass("whitespace-pre-wrap");
  expect(element).toHaveClass("break-words");
  expect(element).toHaveStyle({ overflowWrap: "anywhere" });
  expect(element).not.toHaveClass("whitespace-pre");
}

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

  it("wraps unified diff source content inside fixed line-number gutters", () => {
    renderHunk("unified");

    expectWrappedSource(screen.getByText(longLine));
    expect(screen.getByText("5")).toHaveClass("shrink-0");
    expect(screen.getByText(longLine).parentElement).toHaveClass("min-w-0");
  });

  it("does not reserve staging gutter space for read-only unified diffs", () => {
    renderHunk("unified");

    expect(
      screen.getByText(longLine).parentElement?.parentElement?.children,
    ).toHaveLength(1);
  });

  it("keeps staging gutters in editable unified diffs", () => {
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
        canStage
        isHovered={false}
        setHoveredHunkIdx={vi.fn()}
        displayMode="unified"
      />,
    );

    expect(
      screen.getByText(longLine).parentElement?.parentElement?.children,
    ).toHaveLength(3);
  });

  it("lets unified staging gutters stretch with wrapped source rows", () => {
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
        canStage
        isHovered={false}
        setHoveredHunkIdx={vi.fn()}
        displayMode="unified"
      />,
    );

    const row = screen.getByText(longLine).parentElement?.parentElement;
    const [blockGutter, lineGutter] = Array.from(
      row?.children ?? [],
    ) as HTMLElement[];

    expect(blockGutter).toHaveClass("self-stretch");
    expect(blockGutter).toHaveClass("bg-green-900/20");
    expect(blockGutter).not.toHaveClass("h-full");
    expect(lineGutter).toHaveClass("self-stretch");
    expect(lineGutter).toHaveClass("bg-green-900/20");
    expect(lineGutter).not.toHaveClass("h-full");
  });

  it("wraps split diff source cells inside fixed gutter columns", () => {
    render(
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

    screen.getAllByText(longLine).forEach(expectWrappedSource);
    expect(screen.getAllByText("5")[0].parentElement).toHaveStyle({
      gridTemplateColumns:
        "minmax(0,1fr) 2.5rem 1.5rem 1.5rem 2.5rem minmax(0,1fr)",
    });
  });

  it("wraps split context rows the same way as split diff cells", () => {
    render(
      <DiffHunk
        hunk={createDiffHunk({ lines: [] })}
        filePath="openspec/spec.md"
        hunkIdx={0}
        extraContext={{
          above: [
            createDiffLine({
              content: longLine,
              old_lineno: 5,
              new_lineno: 5,
            }),
          ],
          below: [],
        }}
        canStage
        handleExpandContext={vi.fn()}
        isHovered={false}
        setHoveredHunkIdx={vi.fn()}
        displayMode="split"
      />,
    );

    screen.getAllByText(longLine).forEach(expectWrappedSource);
  });

  it("reserves staging gutters for expanded unified context in editable diffs", () => {
    const contextLine = "nearby context line";

    render(
      <DiffHunk
        hunk={createDiffHunk({
          lines: [
            createDiffLine({
              kind: "Add",
              content: longLine,
              old_lineno: null,
              new_lineno: 6,
            }),
          ],
        })}
        filePath="openspec/spec.md"
        hunkIdx={0}
        extraContext={{
          above: [
            createDiffLine({
              content: contextLine,
              old_lineno: 5,
              new_lineno: 5,
            }),
          ],
          below: [],
        }}
        canStage
        handleExpandContext={vi.fn()}
        isHovered={false}
        setHoveredHunkIdx={vi.fn()}
        displayMode="unified"
      />,
    );

    expect(
      screen.getByText(contextLine).parentElement?.parentElement?.children,
    ).toHaveLength(3);
  });

  it("breaks long unbroken tokens inside the source column", () => {
    render(
      <DiffHunk
        hunk={createDiffHunk({
          lines: [
            createDiffLine({
              kind: "Add",
              content: longToken,
              old_lineno: null,
              new_lineno: 5,
            }),
          ],
        })}
        filePath="openspec/spec.md"
        hunkIdx={0}
        isHovered={false}
        setHoveredHunkIdx={vi.fn()}
        displayMode="unified"
      />,
    );

    expectWrappedSource(screen.getByText(longToken));
    expect(
      screen.getByText(longToken).parentElement,
    ).toHaveClass("min-w-0");
  });
});
