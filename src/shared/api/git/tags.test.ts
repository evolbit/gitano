import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTag, getTags, searchTagCommits } from "./tags";

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
});

