import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRepositoryState,
  initLocalRepoDialog,
  initLocalRepository,
  openLocalRepoDialog,
  openLocalRepository,
} from "./repositories";

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

  it("loads repository state through the typed command adapter", async () => {
    const state = {
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "unborn",
      hasCommits: false,
      isUnborn: true,
      isDetached: false,
    };
    invokeCommandMock.mockResolvedValueOnce(state);

    await expect(getRepositoryState("/repo")).resolves.toBe(state);

    expect(invokeCommandMock).toHaveBeenCalledWith("get_repository_state", {
      path: "/repo",
    });
  });

  it("initializes a local repository through the typed command adapter", async () => {
    invokeCommandMock.mockResolvedValueOnce("ok");

    await expect(initLocalRepository("/repo")).resolves.toBe("ok");

    expect(invokeCommandMock).toHaveBeenCalledWith("init_local_repo", {
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

  it("returns the selected path when initializing a repository succeeds", async () => {
    openDirectoryDialogMock.mockResolvedValueOnce("/repo");
    invokeCommandMock.mockResolvedValueOnce("Repositorio creado correctamente");

    await expect(initLocalRepoDialog()).resolves.toBe("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("init_local_repo", {
      path: "/repo",
    });
  });

  it("returns null when repository initialization is cancelled", async () => {
    openDirectoryDialogMock.mockResolvedValueOnce(null);

    await expect(initLocalRepoDialog()).resolves.toBeNull();
    expect(invokeCommandMock).not.toHaveBeenCalled();
  });
});
