import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FloatingCommitBar from "./floating-commit-bar";

const mocks = vi.hoisted(() => ({
  commitStagedChanges: vi.fn(),
}));

vi.mock("../../hooks/use-stage-and-commit", () => ({
  useStageAndCommit: () => ({
    commitStagedChanges: mocks.commitStagedChanges,
    loading: false,
    error: null,
  }),
}));

describe("FloatingCommitBar", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("expands from the collapsed commit button", () => {
    const onExpand = vi.fn();

    render(
      <FloatingCommitBar
        expanded={false}
        onExpand={onExpand}
        onCollapse={vi.fn()}
        repoPath="/repo"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Commit" }));

    expect(onExpand).toHaveBeenCalledOnce();
  });

  it("commits with push and amend options then collapses", async () => {
    const onCollapse = vi.fn();
    const onCommit = vi.fn();
    mocks.commitStagedChanges.mockResolvedValueOnce(undefined);

    render(
      <FloatingCommitBar
        expanded
        onExpand={vi.fn()}
        onCollapse={onCollapse}
        repoPath="/repo"
        onCommit={onCommit}
      />,
    );

    const commitButton = screen.getByRole("button", { name: "Commit" });
    expect(commitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Commit message..."), {
      target: { value: "Ship changes" },
    });
    fireEvent.click(screen.getByLabelText("Amend last commit"));
    fireEvent.click(commitButton);

    await waitFor(() => {
      expect(mocks.commitStagedChanges).toHaveBeenCalledWith("/repo", "Ship changes", {
        push: true,
        amend: true,
      });
    });
    expect(onCollapse).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith("Ship changes", true, true);
  });
});
