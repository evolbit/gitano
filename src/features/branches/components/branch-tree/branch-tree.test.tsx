import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BranchTreeNode } from "@/shared/lib/tree/branch-tree";
import type { GitBranchRef } from "@/shared/types/git";
import { BranchTree } from "./branch-tree";

const nodes: BranchTreeNode[] = [
  {
    type: "group",
    name: "feature",
    full: "feature",
    children: [{ type: "branch", name: "login", full: "feature/login" }],
  },
];

const branchRefs = new Map<string, GitBranchRef>([
  [
    "feature/login",
    {
      name: "feature/login",
      localName: "feature/login",
      originName: "origin/feature/login",
      localTargetId: "local",
      originTargetId: "origin",
      upstreamName: "origin/feature/login",
      presence: "local-origin",
      aheadCount: 2,
      behindCount: 1,
    },
  ],
]);

function renderTree(overrides: Partial<ComponentProps<typeof BranchTree>> = {}) {
  const props = {
    nodes,
    branchTreeExpanded: { feature: true },
    branchRefByName: branchRefs,
    branchType: "local" as const,
    selectedBranch: "main",
    selectedRowBranch: null,
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
    expect(screen.getByTitle("2 local commits not pushed")).toHaveTextContent(
      "2↑",
    );
    expect(screen.getByTitle("1 remote commits not pulled")).toHaveTextContent(
      "1↓",
    );
  });

  it("checks out remote rows through their origin branch name on double click", () => {
    const props = renderTree({
      branchType: "remote",
      branchRefByName: new Map<string, GitBranchRef>([
        [
          "feature/login",
          {
            name: "feature/login",
            localName: null,
            originName: "origin/feature/login",
            localTargetId: null,
            originTargetId: "origin",
            upstreamName: null,
            presence: "origin",
            aheadCount: null,
            behindCount: null,
          },
        ],
      ]),
    });

    fireEvent.doubleClick(screen.getByText("login"));

    expect(props.onCheckoutBranch).toHaveBeenCalledWith("origin/feature/login");
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
