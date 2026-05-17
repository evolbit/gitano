import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceUiStore } from "@/features/repository-workspace/stores/workspace-ui-store";
import { REPO_LAYOUT } from "@/shared/config/layout";
import { applyWindowConstraints } from "./window-persistence";

const appWindowMock = vi.hoisted(() => ({
  setMinSize: vi.fn(),
  setSizeConstraints: vi.fn(),
  setSize: vi.fn(),
  setPosition: vi.fn(),
}));
const getAppWindowMock = vi.hoisted(() => vi.fn(() => appWindowMock));
const createLogicalSizeMock = vi.hoisted(() =>
  vi.fn((width: number, height: number) => ({ width, height })),
);
const createLogicalPositionMock = vi.hoisted(() =>
  vi.fn((x: number, y: number) => ({ x, y })),
);

vi.mock("@/shared/platform/tauri/window", () => ({
  getAppWindow: getAppWindowMock,
  createLogicalSize: createLogicalSizeMock,
  createLogicalPosition: createLogicalPositionMock,
}));

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe("applyWindowConstraints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceUiStore.setState({
      window: {
        width: REPO_LAYOUT.window.minWidth - 100,
        height: REPO_LAYOUT.window.minHeight - 100,
        x: 12,
        y: 24,
      },
    });
  });

  it("applies minimum window size and persisted position", async () => {
    await applyWindowConstraints();

    expect(appWindowMock.setMinSize).toHaveBeenCalledWith({
      width: REPO_LAYOUT.window.minWidth,
      height: REPO_LAYOUT.window.minHeight,
    });
    expect(appWindowMock.setSizeConstraints).toHaveBeenCalledWith({
      minWidth: REPO_LAYOUT.window.minWidth,
      minHeight: REPO_LAYOUT.window.minHeight,
    });
    expect(appWindowMock.setSize).toHaveBeenCalledWith({
      width: REPO_LAYOUT.window.minWidth,
      height: REPO_LAYOUT.window.minHeight,
    });
    expect(appWindowMock.setPosition).toHaveBeenCalledWith({ x: 12, y: 24 });
  });
});
