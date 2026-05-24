import { afterEach, describe, expect, it } from "vitest";
import { getShowInFileManagerLabel } from "./get-show-in-file-manager-label";

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}

describe("getShowInFileManagerLabel", () => {
  const originalUserAgent = window.navigator.userAgent;

  afterEach(() => {
    setUserAgent(originalUserAgent);
  });

  it("uses Finder wording on macOS", () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");

    expect(getShowInFileManagerLabel()).toBe("Show in Finder");
  });

  it("uses Explorer wording on Windows", () => {
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

    expect(getShowInFileManagerLabel()).toBe("Show in Explorer");
  });

  it("uses generic file manager wording for other platforms", () => {
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64)");

    expect(getShowInFileManagerLabel()).toBe("Show in File Manager");
  });
});
