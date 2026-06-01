import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDirectoryDialog, openLicenseFileDialog } from "./dialog";

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

  it("opens a license file picker", async () => {
    openMock.mockResolvedValueOnce("/tmp/license.gitano-license");

    await expect(openLicenseFileDialog()).resolves.toBe(
      "/tmp/license.gitano-license",
    );

    expect(openMock).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: "Gitano license", extensions: ["gitano-license", "json"] }],
    });
  });
});
