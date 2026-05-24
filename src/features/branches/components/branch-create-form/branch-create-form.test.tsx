import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BranchCreateFormState } from "../../types";
import { BranchCreateForm } from "./branch-create-form";

const createForm: BranchCreateFormState = {
  baseRef: "main",
  prefix: "feature/",
  name: "auth",
};

describe("BranchCreateForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("edits the branch name and submits or cancels from the keyboard", () => {
    const onCreateFormChange = vi.fn();
    const onCreateBranch = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <BranchCreateForm
        createForm={createForm}
        creatingBranch={false}
        createBranchError={null}
        onCreateFormChange={onCreateFormChange}
        onCreateBranch={onCreateBranch}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("feature/auth")).toBeInTheDocument();

    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "billing" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCreateFormChange).toHaveBeenCalledOnce();
    expect(onCreateBranch).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("prevents creating an empty branch name", () => {
    render(
      <BranchCreateForm
        createForm={{ ...createForm, name: "" }}
        creatingBranch={false}
        createBranchError="Branch exists"
        onCreateFormChange={vi.fn()}
        onCreateBranch={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Branch exists")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Branch" })).toBeDisabled();
  });
});
