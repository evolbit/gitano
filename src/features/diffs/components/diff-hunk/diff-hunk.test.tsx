import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiffHunk, createDiffLine } from "@/test/fixtures/git";
import { DiffInteractionProvider } from "../diff-interaction-context/diff-interaction-context";
import DiffHunk from "./diff-hunk";

const longLine =
  "The system SHALL render a long diff line with wrapping so line numbers keep a compact vertical rhythm.";
const longToken =
  "thisIsAnIntentionallyLongUnbrokenTokenUsedToVerifyDiffWrappingDoesNotForceHorizontalOverflowAcrossTheVisiblePane";

function expectWrappedSource(element: HTMLElement) {
  const source = getSourceWrapper(element);

  expect(source).toHaveClass("whitespace-pre-wrap");
  expect(source).toHaveClass("break-words");
  expect(source).toHaveStyle({ overflowWrap: "anywhere" });
  expect(source).not.toHaveClass("whitespace-pre");
}

function getSourceWrapper(element: HTMLElement) {
  const source = element.closest(".whitespace-pre-wrap");

  expect(source).not.toBeNull();
  return source as HTMLElement;
}

function getUnifiedRowFromText(text: string) {
  const row = getSourceWrapper(screen.getByText(text)).closest(".group");

  expect(row).not.toBeNull();
  return row as HTMLElement;
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
    expect(getSourceWrapper(screen.getByText(longLine))).toHaveClass("min-w-0");
    expect(screen.getByText(longLine).closest("[data-monaco-diff-code]")).toHaveAttribute(
      "data-monaco-language",
      "markdown",
    );
  });

  it("does not reserve staging gutter space for read-only unified diffs", () => {
    renderHunk("unified");

    expect(
      getUnifiedRowFromText(longLine).children,
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
      getUnifiedRowFromText(longLine).children,
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

    const row = getUnifiedRowFromText(longLine);
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

  it("renders darker inline highlights for comparable unified changes", () => {
    render(
      <DiffHunk
        hunk={createDiffHunk({
          lines: [
            createDiffLine({
              kind: "Del",
              content: '"@mantine/hooks": "^8.0.2",',
              old_lineno: 16,
              new_lineno: null,
            }),
            createDiffLine({
              kind: "Add",
              content: '"@mantine/hooks": "^8.3.10",',
              old_lineno: null,
              new_lineno: 16,
            }),
          ],
        })}
        filePath="package.json"
        hunkIdx={0}
        isHovered={false}
        setHoveredHunkIdx={vi.fn()}
        displayMode="unified"
      />,
    );

    expect(screen.getByText("0.2")).toHaveClass(
      "bg-red-700/70",
      "text-red-50",
    );
    expect(screen.getByText("3.10")).toHaveClass(
      "bg-green-700/70",
      "text-green-50",
    );
    expect(getSourceWrapper(screen.getByText("0.2"))).toHaveClass(
      "whitespace-pre-wrap",
    );
  });

  it("renders darker inline highlights for comparable split changes", () => {
    render(
      <DiffHunk
        hunk={createDiffHunk({
          lines: [
            createDiffLine({
              kind: "Del",
              content: '"@mantine/hooks": "^8.0.2",',
              old_lineno: 16,
              new_lineno: null,
            }),
            createDiffLine({
              kind: "Add",
              content: '"@mantine/hooks": "^8.3.10",',
              old_lineno: null,
              new_lineno: 16,
            }),
          ],
        })}
        filePath="package.json"
        hunkIdx={0}
        isHovered={false}
        setHoveredHunkIdx={vi.fn()}
        displayMode="split"
      />,
    );

    expect(screen.getByText("0.2")).toHaveClass(
      "bg-red-700/70",
      "text-red-50",
    );
    expect(screen.getByText("3.10")).toHaveClass(
      "bg-green-700/70",
      "text-green-50",
    );
  });

  it("renders split line content inside each side instead of full-width rows", () => {
    render(
      <DiffInteractionProvider
        value={{
          renderLineBelow: (anchor) =>
            anchor.side === "old" ? "Old side thread" : "New side thread",
          renderLineBelowFullWidth: (anchor) =>
            `Full width ${anchor.side} thread`,
        }}
      >
        <DiffHunk
          hunk={createDiffHunk({
            lines: [
              createDiffLine({
                kind: "Del",
                content: '- "pkg": "1.0.0",',
                old_lineno: 13,
                new_lineno: null,
              }),
              createDiffLine({
                kind: "Add",
                content: '+ "pkg": "2.0.0",',
                old_lineno: null,
                new_lineno: 13,
              }),
            ],
          })}
          filePath="package.json"
          hunkIdx={0}
          isHovered={false}
          setHoveredHunkIdx={vi.fn()}
          displayMode="split"
        />
      </DiffInteractionProvider>,
    );

    expect(screen.getByText("Old side thread")).toBeInTheDocument();
    expect(screen.getByText("New side thread")).toBeInTheDocument();
    expect(screen.queryByText("Full width old thread")).not.toBeInTheDocument();
    expect(screen.queryByText("Full width new thread")).not.toBeInTheDocument();
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
      getUnifiedRowFromText(contextLine).children,
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
      getSourceWrapper(screen.getByText(longToken)),
    ).toHaveClass("min-w-0");
  });
});
