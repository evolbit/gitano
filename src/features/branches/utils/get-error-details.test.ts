import { describe, expect, it } from "vitest";
import { getErrorDetails } from "./get-error-details";

describe("getErrorDetails", () => {
  it("uses Error messages when available", () => {
    expect(getErrorDetails(new Error("No upstream"))).toBe("No upstream");
  });

  it("falls back to a stable unknown message for empty values", () => {
    expect(getErrorDetails(null)).toBe("Unknown error");
  });
});
