import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import { BranchTree } from "./branch-tree";

const nodes: BranchTreeNode[] = [
  {
    type: "group",
    name: "feature",
    full: "feature",
    children: [{ type: "branch", name: "login", full: "feature/login" }],
  },
];

function renderTree(overrides = {}) {
  const props = {
    nodes,
    branchTreeExpanded: { feature: true },
    selectedBranch: "main",
    selectedRowBranch: null,
    type: "local" as const,
    isRowActionsVisible: () => true,
    onHoverRow: vi.fn(),
    onToggleGroup: vi.fn(),
    onSelectBranch: vi.fn(),
    onCheckoutBranch: vi.fn(),
    onOpenContextMenu: vi.fn(),
    ...overrides,
  };

  render(<BranchTree {...props} />);
  return props;
}

describe("BranchTree", () => {
  afterEach(() => {
    cleanup();
  });

  it("toggles groups and selects or checks out local branches", () => {
    const props = renderTree();

    fireEvent.click(screen.getByText("feature"));
    fireEvent.click(screen.getByText("login"));
    fireEvent.doubleClick(screen.getByText("login"));

    expect(props.onToggleGroup).toHaveBeenCalledWith("feature", true);
    expect(props.onSelectBranch).toHaveBeenCalledWith("feature/login");
    expect(props.onCheckoutBranch).toHaveBeenCalledWith("feature/login");
  });

  it("opens the context menu from row actions", () => {
    const props = renderTree();

    fireEvent.click(screen.getAllByTitle("More actions")[1]);

    expect(props.onOpenContextMenu).toHaveBeenCalledWith(
      { type: "branch", name: "login", full: "feature/login" },
      expect.any(Number),
      expect.any(Number),
    );
  });
});
