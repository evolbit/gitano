import { describe, expect, it } from "vitest";
import {
  buildRemoteTagUrl,
  encodeRefPath,
  normalizeRemoteUrl,
} from "./remote-tag-url";

describe("remote tag URLs", () => {
  it("normalizes HTTPS and SSH remote URLs", () => {
    expect(normalizeRemoteUrl("https://github.com/acme/app.git")).toBe(
      "https://github.com/acme/app",
    );
    expect(normalizeRemoteUrl("git@gitlab.com:acme/app.git")).toBe(
      "https://gitlab.com/acme/app",
    );
  });

  it("encodes each tag path segment without flattening slashes", () => {
    expect(encodeRefPath("release/1.0 beta")).toBe("release/1.0%20beta");
  });

  it("builds provider-specific tag links", () => {
    expect(buildRemoteTagUrl("git@gitlab.com:acme/app.git", "v1.0.0")).toBe(
      "https://gitlab.com/acme/app/-/tags/v1.0.0",
    );
    expect(
      buildRemoteTagUrl("https://bitbucket.org/acme/app.git", "release/1"),
    ).toBe("https://bitbucket.org/acme/app/src/release/1");
    expect(buildRemoteTagUrl("https://github.com/acme/app.git", "v1.0.0")).toBe(
      "https://github.com/acme/app/tree/v1.0.0",
    );
  });
});

