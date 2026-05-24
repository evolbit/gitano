import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchConfirmModals } from "./branch-confirm-modals";

describe("BranchConfirmModals", () => {
  afterEach(() => {
    cleanup();
  });

  it("requires a changed name before confirming a branch rename", () => {
    const onRenameNameChange = vi.fn();
    const onConfirmRename = vi.fn();

    render(
      <BranchConfirmModals
        renameRequest={{ branchName: "feature/auth" }}
        renameBranchName="feature/auth"
        deleteRequest={null}
        branchActionLoading={false}
        onRenameNameChange={onRenameNameChange}
        onCancelRename={vi.fn()}
        onConfirmRename={onConfirmRename}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Rename Branch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename Branch" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("New branch name"), {
      target: { value: "feature/login" },
    });
    expect(onRenameNameChange).toHaveBeenCalledWith("feature/login");
  });

  it("confirms branch deletion from the delete dialog", () => {
    const onConfirmDelete = vi.fn();

    render(
      <BranchConfirmModals
        renameRequest={null}
        renameBranchName=""
        deleteRequest={{ branchName: "feature/auth" }}
        branchActionLoading={false}
        onRenameNameChange={vi.fn()}
        onCancelRename={vi.fn()}
        onConfirmRename={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={onConfirmDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Branch" }));

    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });
});
