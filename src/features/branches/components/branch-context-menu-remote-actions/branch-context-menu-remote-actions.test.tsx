import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchContextMenuRemoteActions } from "./branch-context-menu-remote-actions";

describe("BranchContextMenuRemoteActions", () => {
  afterEach(() => {
    cleanup();
  });

  it("emits the configured remote action command", () => {
    const onRunRemoteAction = vi.fn();

    render(
      <BranchContextMenuRemoteActions
        branchName="main"
        disabledReason={null}
        itemClass="cursor-pointer"
        onRunRemoteAction={onRunRemoteAction}
      />,
    );

    fireEvent.click(screen.getByText("Push"));

    expect(onRunRemoteAction).toHaveBeenCalledWith(
      "git_branch_push",
      "push",
      "git push succeeded",
      "Pushed main to origin/main.",
      "git push failed",
    );
  });
});
