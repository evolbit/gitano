import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchCompareBranchDropdown } from "./branch-compare-target-dropdown";

describe("BranchCompareBranchDropdown", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters local and remote branch options and selects a branch", () => {
    const onSelectBranch = vi.fn();

    render(
      <BranchCompareBranchDropdown
        selectedBranch={null}
        localBranches={["main", "feature/auth"]}
        remoteBranches={["origin/main"]}
        placeholder="Select target"
        loading={false}
        error={null}
        onSelectBranch={onSelectBranch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Select target/ }));

    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search branches..."), {
      target: { value: "auth" },
    });

    expect(screen.queryByText("main")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "feature/auth" }));

    expect(onSelectBranch).toHaveBeenCalledWith("feature/auth");
  });

  it("shows loading and error states inside the dropdown", () => {
    const { rerender } = render(
      <BranchCompareBranchDropdown
        selectedBranch="main"
        localBranches={[]}
        remoteBranches={[]}
        placeholder="Select target"
        loading
        error={null}
        onSelectBranch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /main/ }));
    expect(screen.getByText("Loading branches...")).toBeInTheDocument();

    rerender(
      <BranchCompareBranchDropdown
        selectedBranch="main"
        localBranches={[]}
        remoteBranches={[]}
        placeholder="Select target"
        loading={false}
        error="Could not load"
        onSelectBranch={vi.fn()}
      />,
    );
    expect(screen.getByText("Could not load")).toBeInTheDocument();
  });
});
