import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangesExplorerMenuButton } from "./changes-explorer-menu-button";

describe("ChangesExplorerMenuButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls its action and marks active selections", () => {
    const onClick = vi.fn();

    const { container } = render(
      <ChangesExplorerMenuButton active onClick={onClick}>
        Tree View
      </ChangesExplorerMenuButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tree View" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("does not call actions while disabled", () => {
    const onClick = vi.fn();

    render(
      <ChangesExplorerMenuButton disabled onClick={onClick}>
        Stash File
      </ChangesExplorerMenuButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stash File" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
