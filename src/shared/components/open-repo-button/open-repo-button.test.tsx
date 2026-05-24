import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenRepoButton } from "./open-repo-button";

const openDirectoryDialogMock = vi.hoisted(() => vi.fn());
const openLocalRepositoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/dialog", () => ({
  openDirectoryDialog: openDirectoryDialogMock,
}));

vi.mock("@/shared/api/repositories", () => ({
  openLocalRepository: openLocalRepositoryMock,
}));

describe("OpenRepoButton", () => {
  beforeEach(() => {
    openDirectoryDialogMock.mockReset();
    openLocalRepositoryMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens a selected repository and shows the result", async () => {
    const user = userEvent.setup();
    openDirectoryDialogMock.mockResolvedValueOnce("/repo");
    openLocalRepositoryMock.mockResolvedValueOnce("Opened /repo");

    render(<OpenRepoButton />);

    await user.click(screen.getByRole("button", { name: /abrir repositorio local/i }));

    expect(openLocalRepositoryMock).toHaveBeenCalledWith("/repo");
    expect(await screen.findByText("Opened /repo")).toBeInTheDocument();
  });

  it("does not open a repository when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    openDirectoryDialogMock.mockResolvedValueOnce(null);

    render(<OpenRepoButton />);

    await user.click(screen.getByRole("button", { name: /abrir repositorio local/i }));

    expect(openLocalRepositoryMock).not.toHaveBeenCalled();
  });
});
