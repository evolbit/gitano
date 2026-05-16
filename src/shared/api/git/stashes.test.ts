import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyStash,
  applyStashFiles,
  dropStash,
  editStashMessage,
  getStashFiles,
  listStashes,
  popStash,
  stashSelectedFiles,
} from "./stashes";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("stash Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("lists stashes with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await listStashes("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_stash_list", {
      path: "/repo",
    });
  });

  it("requests stash files with the backend stashRef payload", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await getStashFiles("/repo", "stash@{0}");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_stash_files", {
      path: "/repo",
      stashRef: "stash@{0}",
    });
  });

  it("stashes selected files with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await stashSelectedFiles("/repo", ["src/a.ts", "src/b.ts"], "WIP");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_stash_selected", {
      path: "/repo",
      filePaths: ["src/a.ts", "src/b.ts"],
      message: "WIP",
    });
  });

  it("passes stash row actions through with stashRef payloads", async () => {
    invokeCommandMock.mockResolvedValue(undefined);

    await applyStash("/repo", "stash@{0}");
    await popStash("/repo", "stash@{1}");
    await dropStash("/repo", "stash@{2}");

    expect(invokeCommandMock).toHaveBeenNthCalledWith(1, "git_stash_apply", {
      path: "/repo",
      stashRef: "stash@{0}",
    });
    expect(invokeCommandMock).toHaveBeenNthCalledWith(2, "git_stash_pop", {
      path: "/repo",
      stashRef: "stash@{1}",
    });
    expect(invokeCommandMock).toHaveBeenNthCalledWith(3, "git_stash_drop", {
      path: "/repo",
      stashRef: "stash@{2}",
    });
  });

  it("applies selected stash files with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await applyStashFiles("/repo", "stash@{0}", ["src/a.ts"]);

    expect(invokeCommandMock).toHaveBeenCalledWith("git_stash_apply_files", {
      path: "/repo",
      stashRef: "stash@{0}",
      filePaths: ["src/a.ts"],
    });
  });

  it("edits stash messages with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await editStashMessage("/repo", "stash@{0}", "Updated message");

    expect(invokeCommandMock).toHaveBeenCalledWith("git_stash_edit_message", {
      path: "/repo",
      stashRef: "stash@{0}",
      newMessage: "Updated message",
    });
  });
});

