import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchContextMenuOtherActions } from "./branch-context-menu-other-actions";

describe("BranchContextMenuOtherActions", () => {
  afterEach(() => {
    cleanup();
  });

  it("copies branch details from the open submenu", () => {
    const onCloseMenus = vi.fn();
    const onCopyText = vi.fn();
    const onCopyBranchTipSha = vi.fn();

    render(
      <BranchContextMenuOtherActions
        branchName="feature/auth"
        showOther
        submenuLeft
        submenuDirection="down"
        otherRef={{ current: null } as RefObject<HTMLDivElement>}
        onShowOtherChange={vi.fn()}
        onCloseMenus={onCloseMenus}
        onCopyText={onCopyText}
        onCopyBranchTipSha={onCopyBranchTipSha}
        onSubmenuMouseEnter={vi.fn()}
        onSubmenuMouseLeave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Copy branch name"));
    fireEvent.click(screen.getByText("Copy commit sha"));

    expect(onCloseMenus).toHaveBeenCalledTimes(2);
    expect(onCopyText).toHaveBeenCalledWith(
      "feature/auth",
      "Copied branch name",
      "Copied feature/auth.",
    );
    expect(onCopyBranchTipSha).toHaveBeenCalledWith("feature/auth");
  });

  it("toggles the submenu from the parent action", () => {
    const onShowOtherChange = vi.fn();

    render(
      <BranchContextMenuOtherActions
        branchName="feature/auth"
        showOther={false}
        submenuLeft
        submenuDirection="down"
        otherRef={{ current: null } as RefObject<HTMLDivElement>}
        onShowOtherChange={onShowOtherChange}
        onCloseMenus={vi.fn()}
        onCopyText={vi.fn()}
        onCopyBranchTipSha={vi.fn()}
        onSubmenuMouseEnter={vi.fn()}
        onSubmenuMouseLeave={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("Otras acciones"));
    fireEvent.click(screen.getByText("Otras acciones"));

    expect(onShowOtherChange).toHaveBeenCalledWith(true);
    expect(typeof onShowOtherChange.mock.calls[1][0]).toBe("function");
  });
});
