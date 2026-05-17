import { describe, expect, it } from "vitest";
import { appTheme } from "./theme";

describe("appTheme", () => {
  it("uses the app typography scale and tooltip defaults", () => {
    expect(appTheme.fontFamily).toBe('"IBM Plex Sans", sans-serif');
    expect(appTheme.fontFamilyMonospace).toBe('"IBM Plex Mono", monospace');
    expect(appTheme.components?.Tooltip?.defaultProps).toMatchObject({
      withArrow: false,
      openDelay: 140,
      offset: 8,
    });
  });
});
