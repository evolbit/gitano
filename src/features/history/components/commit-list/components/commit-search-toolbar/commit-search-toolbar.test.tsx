import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommitSearchToolbar } from "./commit-search-toolbar";

function renderToolbar({
  matchedCount = 2,
  currentMatchPosition = 0,
}: {
  matchedCount?: number;
  currentMatchPosition?: number;
} = {}) {
  const onNavigate = vi.fn();
  const onSearchChange = vi.fn();

  render(
    <MantineProvider>
      <CommitSearchToolbar
        search=""
        matchedCount={matchedCount}
        currentMatchPosition={currentMatchPosition}
        nextShortcut="Ctrl G"
        prevShortcut="Ctrl Shift G"
        onNavigate={onNavigate}
        onSearchChange={onSearchChange}
      />
    </MantineProvider>,
  );

  return { onNavigate, onSearchChange };
}

describe("CommitSearchToolbar", () => {
  it("updates search text and navigates from the keyboard", () => {
    const { onNavigate, onSearchChange } = renderToolbar();

    const input = screen.getByPlaceholderText("Search commits...");
    fireEvent.change(input, { target: { value: "fix cache" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSearchChange).toHaveBeenCalledWith("fix cache");
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("disables navigation buttons when there are no matches", () => {
    renderToolbar({ matchedCount: 0, currentMatchPosition: -1 });

    const disabledButtons = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("disabled"));
    expect(disabledButtons).toHaveLength(2);
    expect(screen.getByText("0/0")).toBeInTheDocument();
  });
});
