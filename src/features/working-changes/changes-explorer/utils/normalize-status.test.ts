import { describe, expect, it } from "vitest";
import { normalizeStatus } from "./normalize-status";

describe("normalizeStatus", () => {
  it("returns allowed statuses unchanged", () => {
    expect(normalizeStatus("renamed")).toBe("renamed");
  });

  it("falls back to modified for unknown statuses", () => {
    expect(normalizeStatus("unmerged")).toBe("modified");
  });
});
