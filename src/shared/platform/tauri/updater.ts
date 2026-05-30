import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";

export const APP_UPDATE_ERRORS = {
  NO_PENDING_UPDATE: "No pending app update is available to install.",
} as const;

export type AppUpdateMetadata = {
  version: string;
  currentVersion: string;
  date: string | null;
  body: string | null;
};

export type AppUpdateDownloadProgress = {
  phase: "started" | "progress" | "finished";
  contentLength: number | null;
  downloadedBytes: number | null;
};

type UpdaterDependencies = {
  check: typeof check;
  relaunch: typeof relaunch;
};

export function createTauriAppUpdater(dependencies: UpdaterDependencies) {
  let pendingUpdate: Update | null = null;

  const checkForUpdate = async (): Promise<AppUpdateMetadata | null> => {
    const update = await dependencies.check();

    if (!update) {
      pendingUpdate = null;
      return null;
    }

    pendingUpdate = update;
    return toAppUpdateMetadata(update);
  };

  const installUpdate = async (
    onProgress?: (progress: AppUpdateDownloadProgress) => void,
  ): Promise<void> => {
    if (!pendingUpdate) {
      throw new Error(APP_UPDATE_ERRORS.NO_PENDING_UPDATE);
    }

    let contentLength: number | null = null;
    let downloadedBytes = 0;

    await pendingUpdate.downloadAndInstall((event) => {
      const progress = toAppUpdateDownloadProgress(
        event,
        contentLength,
        downloadedBytes,
      );
      contentLength = progress.contentLength;
      downloadedBytes = progress.downloadedBytes ?? downloadedBytes;
      onProgress?.(progress);
    });

    pendingUpdate = null;
  };

  return {
    checkForUpdate,
    installUpdate,
    relaunch: dependencies.relaunch,
  };
}

export const tauriAppUpdater = createTauriAppUpdater({ check, relaunch });

export const checkForAppUpdate = tauriAppUpdater.checkForUpdate;
export const installAppUpdate = tauriAppUpdater.installUpdate;
export const relaunchApp = tauriAppUpdater.relaunch;

function toAppUpdateMetadata(update: Update): AppUpdateMetadata {
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    date: update.date ?? null,
    body: update.body ?? null,
  };
}

function toAppUpdateDownloadProgress(
  event: DownloadEvent,
  currentContentLength: number | null,
  currentDownloadedBytes: number,
): AppUpdateDownloadProgress {
  switch (event.event) {
    case "Started":
      return {
        phase: "started",
        contentLength: event.data.contentLength ?? null,
        downloadedBytes: 0,
      };
    case "Progress": {
      const downloadedBytes = currentDownloadedBytes + event.data.chunkLength;
      return {
        phase: "progress",
        contentLength: currentContentLength,
        downloadedBytes,
      };
    }
    case "Finished":
      return {
        phase: "finished",
        contentLength: currentContentLength,
        downloadedBytes: currentContentLength ?? currentDownloadedBytes,
      };
  }
}
