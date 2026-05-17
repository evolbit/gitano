import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchContextMenuCompareItems } from "./branch-context-menu-compare-items";

describe("BranchContextMenuCompareItems", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens branch comparison from the compare action", () => {
    const onCompareBranch = vi.fn();
    const onCloseMenus = vi.fn();

    render(
      <BranchContextMenuCompareItems
        branchName="feature/auth"
        disabledReason={null}
        itemClass="cursor-pointer"
        onCompareBranch={onCompareBranch}
        onCloseMenus={onCloseMenus}
      />,
    );

    const action = screen.getByText("Compare to...");
    fireEvent.click(action);

    expect(onCloseMenus).toHaveBeenCalledOnce();
    expect(onCompareBranch).toHaveBeenCalledWith("feature/auth");
  });

  it("does not start comparison when disabled", () => {
    const onCompareBranch = vi.fn();

    render(
      <BranchContextMenuCompareItems
        branchName="feature/auth"
        disabledReason="Compare is only available for branches"
        itemClass="cursor-not-allowed"
        onCompareBranch={onCompareBranch}
        onCloseMenus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Compare to..."));

    expect(onCompareBranch).not.toHaveBeenCalled();
  });
});
