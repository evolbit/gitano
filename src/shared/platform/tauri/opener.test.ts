import { describe, expect, it, vi } from "vitest";
import { openExternalUrl, revealPathInFileManager } from "./opener";

const openUrlMock = vi.hoisted(() => vi.fn());
const revealItemInDirMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: openUrlMock,
  revealItemInDir: revealItemInDirMock,
}));

describe("revealPathInFileManager", () => {
  it("delegates paths to the Tauri opener plugin", () => {
    revealPathInFileManager("/repo/src/file.ts");

    expect(revealItemInDirMock).toHaveBeenCalledWith("/repo/src/file.ts");
  });
});

describe("openExternalUrl", () => {
  it("delegates URLs to the Tauri opener plugin", () => {
    openExternalUrl("https://github.com/acme/app/commit/abc123");

    expect(openUrlMock).toHaveBeenCalledWith(
      "https://github.com/acme/app/commit/abc123",
    );
  });
});
