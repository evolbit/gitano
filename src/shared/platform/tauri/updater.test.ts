import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_UPDATE_ERRORS,
  createTauriAppUpdater,
  type AppUpdateDownloadProgress,
} from "./updater";

function createUpdate(overrides: Partial<MockUpdate> = {}): MockUpdate {
  return {
    version: "0.2.0",
    currentVersion: "0.1.0",
    date: "2026-05-30T10:00:00Z",
    body: "Release notes",
    rawJson: {},
    available: true,
    rid: 1,
    close: vi.fn(),
    download: vi.fn(),
    install: vi.fn(),
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

type MockUpdate = {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
  rawJson: Record<string, unknown>;
  available: boolean;
  rid: number;
  close: ReturnType<typeof vi.fn>;
  download: ReturnType<typeof vi.fn>;
  install: ReturnType<typeof vi.fn>;
  downloadAndInstall: ReturnType<typeof vi.fn>;
};

describe("createTauriAppUpdater", () => {
  const check = vi.fn();
  const relaunch = vi.fn();

  beforeEach(() => {
    check.mockReset();
    relaunch.mockReset();
  });

  it("returns null when no update is available", async () => {
    check.mockResolvedValueOnce(null);
    const updater = createTauriAppUpdater({ check, relaunch });

    await expect(updater.checkForUpdate()).resolves.toBeNull();
  });

  it("maps available update metadata", async () => {
    check.mockResolvedValueOnce(createUpdate());
    const updater = createTauriAppUpdater({ check, relaunch });

    await expect(updater.checkForUpdate()).resolves.toEqual({
      version: "0.2.0",
      currentVersion: "0.1.0",
      date: "2026-05-30T10:00:00Z",
      body: "Release notes",
    });
  });

  it("downloads and installs the pending update with progress events", async () => {
    const downloadAndInstall = vi.fn(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 25 } });
      onEvent({ event: "Progress", data: { chunkLength: 75 } });
      onEvent({ event: "Finished", data: {} });
    });
    check.mockResolvedValueOnce(createUpdate({ downloadAndInstall }));
    const updater = createTauriAppUpdater({ check, relaunch });
    const progress: AppUpdateDownloadProgress[] = [];

    await updater.checkForUpdate();
    await updater.installUpdate((event) => progress.push(event));

    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(progress).toEqual([
      { phase: "started", contentLength: 100, downloadedBytes: 0 },
      { phase: "progress", contentLength: 100, downloadedBytes: 25 },
      { phase: "progress", contentLength: 100, downloadedBytes: 100 },
      { phase: "finished", contentLength: 100, downloadedBytes: 100 },
    ]);
  });

  it("fails clearly when there is no pending update to install", async () => {
    const updater = createTauriAppUpdater({ check, relaunch });

    await expect(updater.installUpdate()).rejects.toThrow(
      APP_UPDATE_ERRORS.NO_PENDING_UPDATE,
    );
  });

  it("keeps the pending update available when installation fails", async () => {
    const downloadAndInstall = vi
      .fn()
      .mockRejectedValueOnce(new Error("signature verification failed"))
      .mockResolvedValueOnce(undefined);
    check.mockResolvedValueOnce(createUpdate({ downloadAndInstall }));
    const updater = createTauriAppUpdater({ check, relaunch });

    await updater.checkForUpdate();
    await expect(updater.installUpdate()).rejects.toThrow(
      "signature verification failed",
    );
    await expect(updater.installUpdate()).resolves.toBeUndefined();
  });

  it("relaunches through the process plugin", async () => {
    relaunch.mockResolvedValueOnce(undefined);
    const updater = createTauriAppUpdater({ check, relaunch });

    await updater.relaunch();

    expect(relaunch).toHaveBeenCalledOnce();
  });
});
