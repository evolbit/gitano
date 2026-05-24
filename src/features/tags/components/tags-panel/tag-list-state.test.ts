import { describe, expect, it } from "vitest";
import type { GitTagRef } from "@/shared/types/git";
import {
  mergeTagRefs,
  splitTagRefsByLocation,
} from "./tag-list-state";

function localTag(name: string, objectId = `${name}-local`): GitTagRef {
  return {
    name,
    localObjectId: objectId,
    originObjectId: null,
    localTargetId: objectId,
    originTargetId: null,
    status: "local",
    isLocalAnnotated: false,
  };
}

function originTag(name: string, objectId = `${name}-origin`): GitTagRef {
  return {
    name,
    localObjectId: null,
    originObjectId: objectId,
    localTargetId: null,
    originTargetId: objectId,
    status: "origin",
    isLocalAnnotated: false,
  };
}

describe("tag list state", () => {
  it("merges local and origin tag refs into display statuses", () => {
    const tags = mergeTagRefs(
      [localTag("both", "same"), localTag("local-only"), localTag("drifted")],
      [originTag("both", "same"), originTag("origin-only"), originTag("drifted")],
      true,
    );

    expect(tags.map((tag) => [tag.name, tag.status])).toEqual([
      ["both", "local-origin"],
      ["drifted", "conflict"],
      ["local-only", "local"],
      ["origin-only", "origin"],
    ]);
  });

  it("marks local tags unknown when origin is unavailable", () => {
    expect(mergeTagRefs([localTag("offline")], [], false)[0].status).toBe(
      "unknown",
    );
  });

  it("splits merged refs back into query cache locations", () => {
    const { localTags, originTags } = splitTagRefsByLocation(
      mergeTagRefs([localTag("both", "same")], [originTag("both", "same")], true),
    );

    expect(localTags).toHaveLength(1);
    expect(localTags[0]).toMatchObject({
      name: "both",
      localObjectId: "same",
      originObjectId: null,
      status: "local",
    });
    expect(originTags).toHaveLength(1);
    expect(originTags[0]).toMatchObject({
      name: "both",
      localObjectId: null,
      originObjectId: "same",
      status: "origin",
    });
  });
});
