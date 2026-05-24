import { MantineProvider, Tabs } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TabBar from "./tab-bar";

describe("TabBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders repository tabs and dispatches application menu actions", async () => {
    const onAddTab = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <MantineProvider>
        <Tabs value="repo">
          <TabBar
            tabs={[
              { id: "home", repoPath: "" },
              { id: "repo", repoPath: "/Users/me/project" },
            ]}
            activeTab="repo"
            onTabClose={vi.fn()}
            onAddTab={onAddTab}
            onOpenSettings={onOpenSettings}
          />
        </Tabs>
      </MantineProvider>,
    );

    expect(screen.getByText("project")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Open application menu"));
    fireEvent.click(await screen.findByText("New tab"));

    fireEvent.click(screen.getByLabelText("Open application menu"));
    fireEvent.click(await screen.findByText("Settings"));

    expect(onAddTab).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
