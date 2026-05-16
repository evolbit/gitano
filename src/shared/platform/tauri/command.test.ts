import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeCommand } from "./command";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api", () => ({
  core: {
    invoke: invokeMock,
  },
}));

describe("invokeCommand", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("forwards command names and payloads to Tauri core.invoke", async () => {
    invokeMock.mockResolvedValueOnce("opened");

    await expect(
      invokeCommand<string>("open_local_repo", { path: "/repo" }),
    ).resolves.toBe("opened");

    expect(invokeMock).toHaveBeenCalledWith("open_local_repo", {
      path: "/repo",
    });
  });
});
