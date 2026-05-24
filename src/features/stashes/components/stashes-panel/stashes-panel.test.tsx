import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StashesPanel from "./stashes-panel";

const mocks = vi.hoisted(() => ({
  listStashes: vi.fn(),
  getStashFiles: vi.fn(),
  applyStash: vi.fn(),
  applyStashFiles: vi.fn(),
  dropStash: vi.fn(),
  editStashMessage: vi.fn(),
  popStash: vi.fn(),
}));

vi.mock("@gfazioli/mantine-split-pane", () => {
  const Split = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Split.Pane = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Split.Resizer = () => <div data-testid="split-resizer" />;
  return { Split };
});

vi.mock("@/shared/api/git/stashes", () => mocks);

describe("StashesPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads stashes, loads selected stash files, and opens a stash diff", async () => {
    const onOpenStashDiff = vi.fn();
    mocks.listStashes.mockResolvedValue([{ selector: "stash@{0}", hash: "abc", message: "WIP", date: 0 }]);
    mocks.getStashFiles.mockResolvedValue([
      { path: "src/app.ts", status: "modified", insertions: 2, deletions: 1 },
    ]);

    function Harness() {
      const [selectedStashRef, setSelectedStashRef] = useState<string | null>(null);
      const [selectedPath, setSelectedPath] = useState<string | null>(null);
      return (
        <MantineProvider>
          <StashesPanel
            repoPath="/repo"
            selectedStashRef={selectedStashRef}
            selectedStashDiffPath={selectedPath}
            onSelectStashRef={setSelectedStashRef}
            onSelectStashDiffPath={setSelectedPath}
            onOpenStashDiff={onOpenStashDiff}
          />
        </MantineProvider>
      );
    }

    render(<Harness />);

    expect(await screen.findByText("WIP")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getStashFiles).toHaveBeenCalledWith("/repo", "stash@{0}"));

    fireEvent.click(await screen.findByText("app.ts"));

    expect(onOpenStashDiff).toHaveBeenCalledWith("stash@{0}", "src/app.ts");
  });
});
