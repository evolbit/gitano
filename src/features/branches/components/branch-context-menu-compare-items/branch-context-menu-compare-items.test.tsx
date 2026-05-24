import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchContextMenuCompareItems } from "./branch-context-menu-compare-items";

describe("BranchContextMenuCompareItems", () => {
  afterEach(() => {
    cleanup();
  });

  function getByExactText(text: string) {
    return screen.getByText(
      (_content, element) => element?.textContent === text,
    );
  }

  it("opens branch comparison from the selected-against-current action", () => {
    const onCompareBranch = vi.fn();
    const onCloseMenus = vi.fn();

    render(
      <BranchContextMenuCompareItems
        branchName="feature/auth"
        currentBranch="main"
        disabledReason={null}
        itemClass="cursor-pointer"
        onCompareBranch={onCompareBranch}
        onCloseMenus={onCloseMenus}
      />,
    );

    const action = getByExactText("Show changes in feature/auth against main...");
    fireEvent.click(action);

    expect(onCloseMenus).toHaveBeenCalledOnce();
    expect(onCompareBranch).toHaveBeenCalledWith({
      sourceBranch: "feature/auth",
      targetBranch: "main",
    });
  });

  it("opens branch comparison from the current-against-selected action", () => {
    const onCompareBranch = vi.fn();
    const onCloseMenus = vi.fn();

    render(
      <BranchContextMenuCompareItems
        branchName="feature/auth"
        currentBranch="main"
        disabledReason={null}
        itemClass="cursor-pointer"
        onCompareBranch={onCompareBranch}
        onCloseMenus={onCloseMenus}
      />,
    );

    fireEvent.click(getByExactText("Show changes in main against feature/auth..."));

    expect(onCloseMenus).toHaveBeenCalledOnce();
    expect(onCompareBranch).toHaveBeenCalledWith({
      sourceBranch: "main",
      targetBranch: "feature/auth",
    });
  });

  it("does not start comparison when disabled", () => {
    const onCompareBranch = vi.fn();

    render(
      <BranchContextMenuCompareItems
        branchName="feature/auth"
        currentBranch="main"
        disabledReason="Compare is only available for branches"
        itemClass="cursor-not-allowed"
        onCompareBranch={onCompareBranch}
        onCloseMenus={vi.fn()}
      />,
    );

    fireEvent.click(getByExactText("Show changes in feature/auth against main..."));
    fireEvent.click(getByExactText("Show changes in main against feature/auth..."));

    expect(onCompareBranch).not.toHaveBeenCalled();
  });
});
