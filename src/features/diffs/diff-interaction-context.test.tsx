import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDiffLine } from "@/test/fixtures/git";
import {
  DiffInteractionProvider,
  createDiffLineAnchor,
  useDiffInteraction,
} from "./diff-interaction-context";

function Consumer() {
  const context = useDiffInteraction();
  return <span>{context.renderLineAccessory?.(createDiffLineAnchor({
    filePath: "src/file.ts",
    hunkIdx: 0,
    lineIdx: 1,
    line: createDiffLine({ kind: "Add", old_lineno: null, new_lineno: 2 }),
  }))}</span>;
}

describe("diff interaction context", () => {
  it("provides render callbacks to nested consumers", () => {
    render(
      <DiffInteractionProvider
        value={{
          renderLineAccessory: (anchor) => `line-${anchor.newLine}`,
        }}>
        <Consumer />
      </DiffInteractionProvider>,
    );

    expect(screen.getByText("line-2")).toBeInTheDocument();
  });

  it("defaults deleted lines to the old side", () => {
    expect(
      createDiffLineAnchor({
        filePath: "src/file.ts",
        hunkIdx: 0,
        lineIdx: 1,
        line: createDiffLine({ kind: "Del", old_lineno: 2, new_lineno: null }),
      }).side,
    ).toBe("old");
  });
});
