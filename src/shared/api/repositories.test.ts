import { beforeEach, describe, expect, it, vi } from "vitest";
import { openLocalRepoDialog, openLocalRepository } from "./repositories";

const invokeCommandMock = vi.hoisted(() => vi.fn());
const openDirectoryDialogMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

vi.mock("@/shared/platform/tauri/dialog", () => ({
  openDirectoryDialog: openDirectoryDialogMock,
}));

describe("repository API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
    openDirectoryDialogMock.mockReset();
  });

  it("opens a repository through the typed command adapter", async () => {
    invokeCommandMock.mockResolvedValueOnce("ok");

    await expect(openLocalRepository("/repo")).resolves.toBe("ok");

    expect(invokeCommandMock).toHaveBeenCalledWith("open_local_repo", {
      path: "/repo",
    });
  });

  it("returns the selected path when the backend accepts the repository", async () => {
    openDirectoryDialogMock.mockResolvedValueOnce("/repo");
    invokeCommandMock.mockResolvedValueOnce("Repositorio abierto correctamente");

    await expect(openLocalRepoDialog()).resolves.toBe("/repo");
  });

  it("returns null when no directory is selected", async () => {
    openDirectoryDialogMock.mockResolvedValueOnce(null);

    await expect(openLocalRepoDialog()).resolves.toBeNull();
    expect(invokeCommandMock).not.toHaveBeenCalled();
  });
});
