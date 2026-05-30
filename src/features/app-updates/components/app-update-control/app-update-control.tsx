import { ActionIcon } from "@mantine/core";
import { useState } from "react";
import {
  IconCheck,
  IconCloudDownload,
  IconX,
} from "@/shared/components/icons/icons";
import { APP_UPDATE_STATUSES } from "../../constants";
import { useAppUpdate } from "../../hooks/use-app-update";

export function AppUpdateControl() {
  const [open, setOpen] = useState(false);
  const {
    status,
    update,
    progress,
    error,
    busy,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
    restartApp,
  } = useAppUpdate();

  const hasAvailableUpdate = status === APP_UPDATE_STATUSES.AVAILABLE;
  const readyToRestart = status === APP_UPDATE_STATUSES.READY_TO_RESTART;
  const statusText = getStatusText(status, update?.version, progress, error);

  return (
    <div className="relative">
      <ActionIcon
        variant="subtle"
        color={hasAvailableUpdate || readyToRestart ? "blue" : "gray"}
        size="lg"
        aria-label="Open app update menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <IconCloudDownload size={18} />
      </ActionIcon>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[320px] select-none rounded border border-border bg-background-emphasis p-0 text-xs text-zinc-200 shadow-lg">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-foreground">Updates</div>
          <div className="mt-1 leading-5 text-muted-foreground">
            {statusText}
          </div>
        </div>

        {update ? (
          <div className="border-b border-border px-4 py-3 leading-5 text-zinc-300">
            <div className="font-medium text-zinc-100">
              {update.currentVersion} {"->"} {update.version}
            </div>
            {update.body ? (
              <div className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap text-muted-foreground">
                {update.body}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          {hasAvailableUpdate ? (
            <button
              type="button"
              className="h-8 rounded border border-border bg-background px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
              onClick={dismissUpdate}
            >
              Not now
            </button>
          ) : null}

          {hasAvailableUpdate ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded border border-blue-500/50 bg-blue-500/20 px-3 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/30"
              onClick={() => void installUpdate()}
            >
              <IconCloudDownload size={14} />
              Install
            </button>
          ) : null}

          {readyToRestart ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded border border-blue-500/50 bg-blue-500/20 px-3 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/30"
              onClick={() => void restartApp()}
            >
              <IconCheck size={14} />
              Restart
            </button>
          ) : null}

          {!hasAvailableUpdate && !readyToRestart ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded border border-border bg-background px-3 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => void checkForUpdates()}
            >
              {status === APP_UPDATE_STATUSES.ERROR ? (
                <IconX size={14} />
              ) : (
                <IconCloudDownload size={14} />
              )}
              {status === APP_UPDATE_STATUSES.ERROR ? "Try again" : "Check"}
            </button>
          ) : null}
        </div>
        </div>
      ) : null}
    </div>
  );
}

function getStatusText(
  status: string,
  version: string | undefined,
  progress: { contentLength: number | null; downloadedBytes: number | null } | null,
  error: string | null,
): string {
  switch (status) {
    case APP_UPDATE_STATUSES.CHECKING:
      return "Checking for updates...";
    case APP_UPDATE_STATUSES.UNAVAILABLE:
      return "Gitano is up to date.";
    case APP_UPDATE_STATUSES.AVAILABLE:
      return version ? `Version ${version} is available.` : "An update is available.";
    case APP_UPDATE_STATUSES.DOWNLOADING:
      return formatProgress(progress);
    case APP_UPDATE_STATUSES.READY_TO_RESTART:
      return "Update installed. Restart Gitano to finish.";
    case APP_UPDATE_STATUSES.ERROR:
      return error ?? "Update check failed.";
    case APP_UPDATE_STATUSES.IDLE:
    default:
      return "Check for a newer Gitano version.";
  }
}

function formatProgress(
  progress: { contentLength: number | null; downloadedBytes: number | null } | null,
): string {
  if (!progress) return "Downloading update...";
  if (!progress.contentLength || progress.downloadedBytes === null) {
    return "Downloading update...";
  }

  const percentage = Math.min(
    100,
    Math.round((progress.downloadedBytes / progress.contentLength) * 100),
  );

  return `Downloading update... ${percentage}%`;
}
