import { describe, expect, it } from "vitest";
import { classNames } from "./class-names";

describe("classNames", () => {
  it("joins truthy class names in order", () => {
    expect(classNames("base", "", "active")).toBe("base active");
  });
});
