import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchListHeader } from "./branch-list-header";

describe("BranchListHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters branches, switches branch type, and starts branch creation", () => {
    const onSearchChange = vi.fn();
    const onTypeChange = vi.fn();
    const onCreateBranch = vi.fn();

    render(
      <BranchListHeader
        search=""
        type="local"
        onSearchChange={onSearchChange}
        onTypeChange={onTypeChange}
        onCreateBranch={onCreateBranch}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search branches..."), {
      target: { value: "feature" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remote branches" }));
    fireEvent.click(screen.getByRole("button", { name: "Add branch" }));

    expect(onSearchChange).toHaveBeenCalledWith("feature");
    expect(onTypeChange).toHaveBeenCalledWith("remote");
    expect(onCreateBranch).toHaveBeenCalledOnce();
  });

  it("disables the create action when branch creation is unavailable", () => {
    const onCreateBranch = vi.fn();

    render(
      <BranchListHeader
        search=""
        type="local"
        onSearchChange={vi.fn()}
        onTypeChange={vi.fn()}
        onCreateBranch={onCreateBranch}
        createDisabled
        createDisabledReason="Create an initial commit first"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add branch" }));

    expect(onCreateBranch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add branch" })).toHaveAttribute(
      "title",
      "Create an initial commit first",
    );
  });
});
