import { describe, expect, it, vi } from "vitest";
import { listenToEvent } from "./events";

const listenMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("listenToEvent", () => {
  it("delegates event names and handlers to Tauri listen", () => {
    const handler = vi.fn();

    listenToEvent("gitano:repo-changed", handler);

    expect(listenMock).toHaveBeenCalledWith("gitano:repo-changed", handler);
  });
});
