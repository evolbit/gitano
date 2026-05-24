import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkTagNameAvailability,
  createTag,
  deleteTag,
  getLocalTagRefs,
  getOriginTagRefs,
  getTagRefs,
  getTags,
  pushTag,
  renameTag,
  searchTagCommits,
} from "./tags";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("tag Git API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("lists tags with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce(["v1.0.0"]);

    await expect(getTags("/repo")).resolves.toEqual(["v1.0.0"]);

    expect(invokeCommandMock).toHaveBeenCalledWith("get_tags", {
      path: "/repo",
    });
  });

  it("searches tag commits with the expected payload and limit", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await searchTagCommits("/repo", "fix");

    expect(invokeCommandMock).toHaveBeenCalledWith("search_tag_commits", {
      path: "/repo",
      query: "fix",
      limit: 50,
    });
  });

  it("gets merged tag refs with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce({ tags: [] });

    await getTagRefs("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("get_tag_refs", {
      path: "/repo",
    });
  });

  it("gets local tag refs with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await getLocalTagRefs("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("get_local_tag_refs", {
      path: "/repo",
    });
  });

  it("gets origin tag refs with the expected command", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await getOriginTagRefs("/repo");

    expect(invokeCommandMock).toHaveBeenCalledWith("get_origin_tag_refs", {
      path: "/repo",
    });
  });

  it("checks tag name availability with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({ validName: true });

    await checkTagNameAvailability("/repo", "v1.0.0");

    expect(invokeCommandMock).toHaveBeenCalledWith("check_tag_name_availability", {
      path: "/repo",
      tagName: "v1.0.0",
    });
  });

  it("creates tags with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await createTag("/repo", "v1.0.0", "abc123", true, "Release 1.0.0");

    expect(invokeCommandMock).toHaveBeenCalledWith("create_tag", {
      path: "/repo",
      tagName: "v1.0.0",
      commitSha: "abc123",
      annotated: true,
      description: "Release 1.0.0",
    });
  });

  it("pushes one tag with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await pushTag("/repo", "v1.0.0");

    expect(invokeCommandMock).toHaveBeenCalledWith("push_tag", {
      path: "/repo",
      tagName: "v1.0.0",
    });
  });

  it("renames a tag with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await renameTag("/repo", "v1.0.0", "v1.0.1");

    expect(invokeCommandMock).toHaveBeenCalledWith("rename_tag", {
      path: "/repo",
      oldTagName: "v1.0.0",
      newTagName: "v1.0.1",
    });
  });

  it("deletes tag locations with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await deleteTag("/repo", "v1.0.0", {
      deleteLocal: true,
      deleteOrigin: false,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("delete_tag", {
      path: "/repo",
      tagName: "v1.0.0",
      deleteLocal: true,
      deleteOrigin: false,
    });
  });
});
