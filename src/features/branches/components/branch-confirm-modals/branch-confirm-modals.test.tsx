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

  it("shows forced branch deletion details from the delete dialog", () => {
    const onConfirmDelete = vi.fn();

    render(
      <BranchConfirmModals
        renameRequest={null}
        renameBranchName=""
        deleteRequest={{ branchName: "feature/auth", force: true }}
        branchActionLoading={false}
        onRenameNameChange={vi.fn()}
        onCancelRename={vi.fn()}
        onConfirmRename={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={onConfirmDelete}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Delete feature/auth (force)" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/git branch -D/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Force Delete Branch" }));

    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });

  it("shows remote branch deletion details from the delete dialog", () => {
    const onConfirmDelete = vi.fn();

    render(
      <BranchConfirmModals
        renameRequest={null}
        renameBranchName=""
        deleteRequest={{ branchName: "origin/feature/auth", remote: true }}
        branchActionLoading={false}
        onRenameNameChange={vi.fn()}
        onCancelRename={vi.fn()}
        onConfirmRename={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={onConfirmDelete}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Delete origin/feature/auth" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/git push origin --delete/)).toBeInTheDocument();
    expect(screen.getByText(/deleted from origin/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Remote Branch" }));

    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });

});
