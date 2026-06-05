import { describe, expect, it } from "vitest";
import { ChangeType } from "@/shared/types/git";
import { normalizeStatus } from "./normalize-status";

describe("normalizeStatus", () => {
  it("returns allowed statuses unchanged", () => {
    expect(normalizeStatus(ChangeType.Renamed)).toBe(ChangeType.Renamed);
    expect(normalizeStatus(ChangeType.Conflicted)).toBe(ChangeType.Conflicted);
  });

  it("falls back to modified for unknown statuses", () => {
    expect(normalizeStatus("unmerged")).toBe(ChangeType.Modified);
  });
});
