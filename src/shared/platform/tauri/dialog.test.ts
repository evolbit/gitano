import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDirectoryDialog } from "./dialog";

const openMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: openMock,
}));

describe("openDirectoryDialog", () => {
  beforeEach(() => {
    openMock.mockReset();
  });

  it("returns the selected directory path", async () => {
    openMock.mockResolvedValueOnce("/repo");

    await expect(openDirectoryDialog("/home")).resolves.toBe("/repo");

    expect(openMock).toHaveBeenCalledWith({
      directory: true,
      defaultPath: "/home",
    });
  });

  it("normalizes non-string selections to null", async () => {
    openMock.mockResolvedValueOnce(["/repo"]);

    await expect(openDirectoryDialog()).resolves.toBeNull();
  });
});
