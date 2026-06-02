import { describe, expect, it } from "vitest";
import {
  buildRemoteBranchUrl,
  buildRemoteCommitUrl,
  encodeRefPath,
  normalizeWebRemoteUrl,
} from "./remote-url";

describe("remote URL helpers", () => {
  it("normalizes HTTPS and SSH remotes", () => {
    expect(normalizeWebRemoteUrl("https://github.com/acme/app.git")).toBe(
      "https://github.com/acme/app",
    );
    expect(normalizeWebRemoteUrl("git@gitlab.com:acme/app.git")).toBe(
      "https://gitlab.com/acme/app",
    );
    expect(normalizeWebRemoteUrl("/Users/me/app")).toBeNull();
  });

  it("encodes each ref path segment without flattening slashes", () => {
    expect(encodeRefPath("feature/login flow")).toBe(
      "feature/login%20flow",
    );
  });
});

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

describe("buildRemoteBranchUrl", () => {
  it("builds GitHub branch URLs", () => {
    expect(
      buildRemoteBranchUrl(
        "https://github.com/acme/app.git",
        "feature/login flow",
      ),
    ).toBe("https://github.com/acme/app/tree/feature/login%20flow");
  });

  it("builds GitLab branch URLs", () => {
    expect(
      buildRemoteBranchUrl("git@gitlab.com:acme/app.git", "feature/login"),
    ).toBe("https://gitlab.com/acme/app/-/tree/feature/login");
  });

  it("builds Bitbucket branch URLs", () => {
    expect(
      buildRemoteBranchUrl(
        "https://bitbucket.org/acme/app.git",
        "feature/login",
      ),
    ).toBe("https://bitbucket.org/acme/app/src/feature/login");
  });

  it("returns null for local paths and blank branches", () => {
    expect(buildRemoteBranchUrl("/Users/me/app", "main")).toBeNull();
    expect(buildRemoteBranchUrl("https://github.com/acme/app.git", " ")).toBeNull();
  });
});
