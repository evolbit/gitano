import { MantineProvider, Menu } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ToolbarDropdownBody,
  ToolbarDropdownItem,
  WorktreeDropdownItem,
} from "./toolbar-dropdown";

function renderMenu(children: React.ReactNode) {
  render(
    <MantineProvider>
      <Menu opened>
        <Menu.Target>
          <button type="button">Open</button>
        </Menu.Target>
        {children}
      </Menu>
    </MantineProvider>,
  );
}

describe("toolbar dropdown components", () => {
  it("updates search value from the dropdown search input", () => {
    const onSearchChange = vi.fn();

    renderMenu(
      <ToolbarDropdownBody
        searchValue=""
        onSearchChange={onSearchChange}
      >
        <div>content</div>
      </ToolbarDropdownBody>,
    );
    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "feature" },
    });

    expect(onSearchChange).toHaveBeenCalledWith("feature");
  });

  it("renders clickable branch and worktree items", () => {
    const onBranchClick = vi.fn();
    const onWorktreeClick = vi.fn();

    renderMenu(
      <ToolbarDropdownBody
        searchValue=""
        onSearchChange={vi.fn()}
      >
        <ToolbarDropdownItem
          label="main"
          onClick={onBranchClick}
        />
        <WorktreeDropdownItem
          worktree={{
            path: "/repo/feature",
            name: "feature-worktree",
            branch: "feature",
            head: null,
            isCurrent: false,
            isMain: false,
            isBare: false,
            isDetached: false,
          }}
          onClick={onWorktreeClick}
        />
      </ToolbarDropdownBody>,
    );

    fireEvent.click(screen.getByText("main"));
    fireEvent.click(screen.getByText("feature-worktree"));

    expect(onBranchClick).toHaveBeenCalledOnce();
    expect(onWorktreeClick).toHaveBeenCalledOnce();
  });

  it("shows the detached HEAD commit for detached worktree rows", () => {
    renderMenu(
      <ToolbarDropdownBody
        searchValue=""
        onSearchChange={vi.fn()}
      >
        <WorktreeDropdownItem
          worktree={{
            path: "/repo/ef7f",
            name: "ef7f",
            branch: null,
            head: "a557509c78608700fd2b1c616b2c658260048dc8",
            isCurrent: false,
            isMain: false,
            isBare: false,
            isDetached: true,
          }}
          onClick={vi.fn()}
        />
      </ToolbarDropdownBody>,
    );

    expect(screen.getByText(/Detached HEAD @ a557509/)).toBeInTheDocument();
  });
});
