import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileSelectionCheckbox } from "./file-selection-checkbox";

describe("FileSelectionCheckbox", () => {
  afterEach(() => {
    cleanup();
  });

  it("reports mixed checkbox state and stops row click propagation", () => {
    const onToggle = vi.fn();
    const onRowClick = vi.fn();

    render(
      <div onClick={onRowClick}>
        <FileSelectionCheckbox checkboxState="indeterminate" onToggle={onToggle} />
      </div>,
    );

    const checkbox = screen.getByRole("button", { name: "Toggle file selection" });
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");

    fireEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
