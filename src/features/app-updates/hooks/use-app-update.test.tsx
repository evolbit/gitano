import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_UPDATE_STATUSES } from "../constants";
import { useAppUpdate } from "./use-app-update";

const updaterMocks = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  installAppUpdate: vi.fn(),
  relaunchApp: vi.fn(),
}));

vi.mock("@/shared/platform/tauri/updater", () => updaterMocks);

const availableUpdate = {
  version: "0.2.0",
  currentVersion: "0.1.0",
  date: "2026-05-30T10:00:00Z",
  body: "Release notes",
};

describe("useAppUpdate", () => {
  beforeEach(() => {
    updaterMocks.checkForAppUpdate.mockReset();
    updaterMocks.installAppUpdate.mockReset();
    updaterMocks.relaunchApp.mockReset();
  });

  it("reports when Gitano is up to date", async () => {
    updaterMocks.checkForAppUpdate.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe(APP_UPDATE_STATUSES.UNAVAILABLE);
    expect(result.current.update).toBeNull();
  });

  it("stores available update metadata", async () => {
    updaterMocks.checkForAppUpdate.mockResolvedValueOnce(availableUpdate);
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe(APP_UPDATE_STATUSES.AVAILABLE);
    expect(result.current.update).toEqual(availableUpdate);
  });

  it("installs an available update and waits for explicit restart", async () => {
    updaterMocks.checkForAppUpdate.mockResolvedValueOnce(availableUpdate);
    updaterMocks.installAppUpdate.mockImplementationOnce(async (onProgress) => {
      onProgress({
        phase: "progress",
        contentLength: 100,
        downloadedBytes: 50,
      });
    });
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });
    await act(async () => {
      await result.current.installUpdate();
    });

    expect(updaterMocks.installAppUpdate).toHaveBeenCalledOnce();
    expect(result.current.status).toBe(APP_UPDATE_STATUSES.READY_TO_RESTART);
    expect(updaterMocks.relaunchApp).not.toHaveBeenCalled();
  });

  it("can relaunch after an update is ready", async () => {
    updaterMocks.relaunchApp.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.restartApp();
    });

    expect(updaterMocks.relaunchApp).toHaveBeenCalledOnce();
  });

  it("shows a recoverable error when checking fails", async () => {
    updaterMocks.checkForAppUpdate.mockRejectedValueOnce(
      new Error("endpoint unavailable"),
    );
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status).toBe(APP_UPDATE_STATUSES.ERROR);
    expect(result.current.error).toBe("endpoint unavailable");
  });

  it("lets the user decline an available update", async () => {
    updaterMocks.checkForAppUpdate.mockResolvedValueOnce(availableUpdate);
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });
    act(() => {
      result.current.dismissUpdate();
    });

    expect(result.current.status).toBe(APP_UPDATE_STATUSES.IDLE);
    expect(result.current.update).toBeNull();
  });
});
