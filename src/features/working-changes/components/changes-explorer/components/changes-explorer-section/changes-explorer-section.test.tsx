import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChangesExplorerSection } from "./changes-explorer-section";

describe("ChangesExplorerSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows section headers only in tracked/untracked mode", () => {
    const { rerender } = render(
      <ChangesExplorerSection name="Tracked" sectionMode="tracked-untracked">
        <div>tracked file</div>
      </ChangesExplorerSection>,
    );

    expect(screen.getByText("Tracked")).toBeInTheDocument();

    rerender(
      <ChangesExplorerSection name="Tracked" sectionMode="single">
        <div>tracked file</div>
      </ChangesExplorerSection>,
    );

    expect(screen.queryByText("Tracked")).not.toBeInTheDocument();
    expect(screen.getByText("tracked file")).toBeInTheDocument();
  });
});
