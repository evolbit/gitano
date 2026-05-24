import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchList } from "./branch-list";

const mocks = vi.hoisted(() => ({
  state: undefined as Record<string, unknown> | undefined,
}));

vi.mock("../../hooks/use-branch-list-behavior", () => ({
  useBranchListBehavior: () => mocks.state,
}));

function branchListState(overrides: Record<string, unknown> = {}) {
  return {
    repoPath: "/repo",
    search: "",
    setSearch: vi.fn(),
    type: "local",
    setType: vi.fn(),
    selectedBranch: "main",
    beginCreateBranch: vi.fn(),
    requiresInitialCommit: false,
    loading: false,
    error: null,
    grouped: [],
    branchTreeExpanded: {},
    selectedRowBranch: null,
    isRowActionsVisible: vi.fn().mockReturnValue(false),
    setHoveredRowKey: vi.fn(),
    toggleGroup: vi.fn(),
    setSelectedRowBranch: vi.fn(),
    checkoutBranch: vi.fn(),
    openContextMenu: vi.fn(),
    contextMenu: null,
    menuPos: null,
    menuRef: { current: null },
    creatingWorktree: false,
    closeContextMenu: vi.fn(),
    runBranchOperation: vi.fn(),
    runRemoteBranchAction: vi.fn(),
    createRandomWorktreeFromBranch: vi.fn(),
    copyText: vi.fn(),
    copyBranchTipSha: vi.fn(),
    openBranchCompare: vi.fn(),
    requestRenameBranch: vi.fn(),
    requestDeleteBranch: vi.fn(),
    createForm: null,
    creatingBranch: false,
    createBranchError: null,
    setCreateForm: vi.fn(),
    createBranch: vi.fn(),
    cancelCreateBranch: vi.fn(),
    renameRequest: null,
    renameBranchName: "",
    deleteRequest: null,
    branchActionLoading: false,
    setRenameBranchName: vi.fn(),
    cancelRenameBranch: vi.fn(),
    renameBranch: vi.fn(),
    cancelDeleteBranch: vi.fn(),
    deleteBranch: vi.fn(),
    branchComparison: null,
    closeBranchCompare: vi.fn(),
    ...overrides,
  };
}

describe("BranchList", () => {
  afterEach(() => {
    cleanup();
    mocks.state = undefined;
  });

  it("renders nothing without a repository path", () => {
    mocks.state = branchListState({ repoPath: undefined });

    const { container } = render(<BranchList />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows empty state and starts branch creation from the header", () => {
    const state = branchListState();
    mocks.state = state;

    render(<BranchList />);

    expect(screen.getByText("No branches found")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add branch" }));

    expect(state.beginCreateBranch).toHaveBeenCalledWith("main");
  });
});
