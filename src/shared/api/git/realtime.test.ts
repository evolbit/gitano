import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncRepoWatchers } from "./realtime";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("realtime Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("syncs watcher paths through a typed payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await syncRepoWatchers(["/repo-a", "/repo-b"]);

    expect(invokeCommandMock).toHaveBeenCalledWith("sync_repo_watchers", {
      repoPaths: ["/repo-a", "/repo-b"],
    });
  });
});
