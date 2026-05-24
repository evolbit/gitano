import { describe, expect, it } from "vitest";
import type { GitTagRef } from "@/shared/types/git";
import {
  canDeleteLocalTag,
  canDeleteOriginTag,
  canPushTag,
  canRenameTag,
  getTagStatusLabel,
} from "./tag-refs";

function tag(overrides: Partial<GitTagRef>): GitTagRef {
  return {
    name: "v1.0.0",
    localObjectId: null,
    originObjectId: null,
    localTargetId: null,
    originTargetId: null,
    status: "origin",
    isLocalAnnotated: false,
    ...overrides,
  };
}

describe("tag ref utilities", () => {
  it("labels tag statuses", () => {
    expect(getTagStatusLabel("local-origin")).toBe("Local · Origin");
    expect(getTagStatusLabel("conflict")).toBe("Conflict");
  });

  it("derives allowed actions from tag state", () => {
    const localOnly = tag({
      localObjectId: "abc",
      localTargetId: "abc",
      status: "local",
    });
    const originOnly = tag({
      originObjectId: "abc",
      originTargetId: "abc",
      status: "origin",
    });

    expect(canPushTag(localOnly)).toBe(true);
    expect(canRenameTag(localOnly)).toBe(true);
    expect(canDeleteLocalTag(localOnly)).toBe(true);
    expect(canDeleteOriginTag(localOnly)).toBe(false);
    expect(canPushTag(originOnly)).toBe(false);
    expect(canRenameTag(originOnly)).toBe(false);
    expect(canDeleteLocalTag(originOnly)).toBe(false);
    expect(canDeleteOriginTag(originOnly)).toBe(true);
  });
});
