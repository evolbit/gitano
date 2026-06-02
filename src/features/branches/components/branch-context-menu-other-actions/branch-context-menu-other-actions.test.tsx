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
        remoteBranchName={null}
        remoteCommitSha={null}
        hasRemoteProviderUrl={false}
        showOther
        submenuLeft
        submenuDirection="down"
        otherRef={{ current: null } as RefObject<HTMLDivElement>}
        onShowOtherChange={vi.fn()}
        onCloseMenus={onCloseMenus}
        onCopyText={onCopyText}
        onCopyBranchTipSha={onCopyBranchTipSha}
        onCopyRemoteBranchUrl={vi.fn()}
        onCopyRemoteCommitUrl={vi.fn()}
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
        remoteBranchName={null}
        remoteCommitSha={null}
        hasRemoteProviderUrl={false}
        showOther={false}
        submenuLeft
        submenuDirection="down"
        otherRef={{ current: null } as RefObject<HTMLDivElement>}
        onShowOtherChange={onShowOtherChange}
        onCloseMenus={vi.fn()}
        onCopyText={vi.fn()}
        onCopyBranchTipSha={vi.fn()}
        onCopyRemoteBranchUrl={vi.fn()}
        onCopyRemoteCommitUrl={vi.fn()}
        onSubmenuMouseEnter={vi.fn()}
        onSubmenuMouseLeave={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("Otras acciones"));
    fireEvent.click(screen.getByText("Otras acciones"));

    expect(onShowOtherChange).toHaveBeenCalledWith(true);
    expect(typeof onShowOtherChange.mock.calls[1][0]).toBe("function");
  });

  it("copies provider links when a remote branch URL is available", () => {
    const onCopyRemoteBranchUrl = vi.fn();
    const onCopyRemoteCommitUrl = vi.fn();

    render(
      <BranchContextMenuOtherActions
        branchName="origin/feature/auth"
        remoteBranchName="origin/feature/auth"
        remoteCommitSha="abc123"
        hasRemoteProviderUrl
        showOther
        submenuLeft
        submenuDirection="down"
        otherRef={{ current: null } as RefObject<HTMLDivElement>}
        onShowOtherChange={vi.fn()}
        onCloseMenus={vi.fn()}
        onCopyText={vi.fn()}
        onCopyBranchTipSha={vi.fn()}
        onCopyRemoteBranchUrl={onCopyRemoteBranchUrl}
        onCopyRemoteCommitUrl={onCopyRemoteCommitUrl}
        onSubmenuMouseEnter={vi.fn()}
        onSubmenuMouseLeave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Copy branch URL"));
    fireEvent.click(screen.getByText("Copy commit URL on origin"));

    expect(onCopyRemoteBranchUrl).toHaveBeenCalledWith("origin/feature/auth");
    expect(onCopyRemoteCommitUrl).toHaveBeenCalledWith(
      "origin/feature/auth",
      "abc123",
    );
  });
});
