import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
  BranchContextMenuSeparator,
} from "./branch-context-menu-parts";

describe("branch context menu parts", () => {
  afterEach(() => {
    cleanup();
  });

  it("fires item clicks and renders section separators", () => {
    const onClick = vi.fn();

    const { container } = render(
      <>
        <BranchContextMenuSectionTitle>Actions</BranchContextMenuSectionTitle>
        <BranchContextMenuItem className="cursor-pointer" title="Run" onClick={onClick}>
          Checkout
        </BranchContextMenuItem>
        <BranchContextMenuSeparator />
      </>,
    );

    fireEvent.click(screen.getByText("Checkout"));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(container.querySelector(".border-t")).toBeInTheDocument();
  });
});
