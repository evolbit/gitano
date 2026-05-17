import { describe, expect, it } from "vitest";
import { buildRemoteCommitUrl } from "./remote-url";

describe("buildRemoteCommitUrl", () => {
  it("builds GitHub commit URLs from HTTPS remotes", () => {
    expect(
      buildRemoteCommitUrl("https://github.com/acme/app.git", "abc123"),
    ).toBe("https://github.com/acme/app/commit/abc123");
  });

  it("builds GitHub commit URLs from SCP-style SSH remotes", () => {
    expect(buildRemoteCommitUrl("git@github.com:acme/app.git", "abc123")).toBe(
      "https://github.com/acme/app/commit/abc123",
    );
  });

  it("builds GitLab commit URLs", () => {
    expect(
      buildRemoteCommitUrl("git@gitlab.com:acme/app.git", "abc123"),
    ).toBe("https://gitlab.com/acme/app/-/commit/abc123");
  });

  it("builds Bitbucket commit URLs", () => {
    expect(
      buildRemoteCommitUrl("https://bitbucket.org/acme/app.git", "abc123"),
    ).toBe("https://bitbucket.org/acme/app/commits/abc123");
  });

  it("returns null for local paths and blank commits", () => {
    expect(buildRemoteCommitUrl("/Users/me/app", "abc123")).toBeNull();
    expect(buildRemoteCommitUrl("https://github.com/acme/app.git", " ")).toBeNull();
  });
});
