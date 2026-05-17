import { describe, expect, it, vi } from "vitest";
import {
  createLogicalPosition,
  createLogicalSize,
  getAppWindow,
} from "./window";

const currentWindow = vi.hoisted(() => ({ label: "main" }));
const getCurrentWindowMock = vi.hoisted(() => vi.fn(() => currentWindow));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: getCurrentWindowMock,
  LogicalSize: class {
    constructor(
      public width: number,
      public height: number,
    ) {}
  },
  LogicalPosition: class {
    constructor(
      public x: number,
      public y: number,
    ) {}
  },
}));

describe("Tauri window adapter", () => {
  it("returns the current Tauri window", () => {
    expect(getAppWindow()).toBe(currentWindow);
    expect(getCurrentWindowMock).toHaveBeenCalledOnce();
  });

  it("creates logical geometry values", () => {
    expect(createLogicalSize(800, 600)).toMatchObject({
      width: 800,
      height: 600,
    });
    expect(createLogicalPosition(12, 24)).toMatchObject({ x: 12, y: 24 });
  });
});
