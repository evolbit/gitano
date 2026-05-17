import { describe, expect, it, vi } from "vitest";
import { revealPathInFileManager } from "./opener";

const revealItemInDirMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: revealItemInDirMock,
}));

describe("revealPathInFileManager", () => {
  it("delegates paths to the Tauri opener plugin", () => {
    revealPathInFileManager("/repo/src/file.ts");

    expect(revealItemInDirMock).toHaveBeenCalledWith("/repo/src/file.ts");
  });
});
