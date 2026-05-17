import { describe, expect, it } from "vitest";
import { serializeLineSelection } from "./serialize-line-selection";

describe("serializeLineSelection", () => {
  it("sorts selected line indexes by hunk", () => {
    expect(
      serializeLineSelection({
        2: new Set([5, 1]),
        0: new Set([3, 2]),
      }),
    ).toEqual({
      0: [2, 3],
      2: [1, 5],
    });
  });

  it("omits empty and invalid selections", () => {
    expect(
      serializeLineSelection({
        0: new Set(),
      }),
    ).toEqual({});
  });
});
