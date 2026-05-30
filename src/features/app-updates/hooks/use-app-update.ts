import { useCallback, useMemo, useState } from "react";
import {
  checkForAppUpdate,
  installAppUpdate,
  relaunchApp,
  type AppUpdateDownloadProgress,
  type AppUpdateMetadata,
} from "@/shared/platform/tauri/updater";
import { APP_UPDATE_STATUSES, type AppUpdateStatus } from "../constants";

type AppUpdateState = {
  status: AppUpdateStatus;
  update: AppUpdateMetadata | null;
  progress: AppUpdateDownloadProgress | null;
  error: string | null;
};

const INITIAL_UPDATE_STATE: AppUpdateState = {
  status: APP_UPDATE_STATUSES.IDLE,
  update: null,
  progress: null,
  error: null,
};

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>(INITIAL_UPDATE_STATE);

  const checkForUpdates = useCallback(async () => {
    setState((current) => ({
      ...current,
      status: APP_UPDATE_STATUSES.CHECKING,
      progress: null,
      error: null,
    }));

    try {
      const update = await checkForAppUpdate();
      setState({
        status: update
          ? APP_UPDATE_STATUSES.AVAILABLE
          : APP_UPDATE_STATUSES.UNAVAILABLE,
        update,
        progress: null,
        error: null,
      });
    } catch (error) {
      setState({
        status: APP_UPDATE_STATUSES.ERROR,
        update: null,
        progress: null,
        error: errorMessage(error),
      });
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!state.update) return;

    setState((current) => ({
      ...current,
      status: APP_UPDATE_STATUSES.DOWNLOADING,
      progress: null,
      error: null,
    }));

    try {
      await installAppUpdate((progress) => {
        setState((current) => ({
          ...current,
          status: APP_UPDATE_STATUSES.DOWNLOADING,
          progress,
          error: null,
        }));
      });
      setState((current) => ({
        ...current,
        status: APP_UPDATE_STATUSES.READY_TO_RESTART,
        progress: null,
        error: null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: APP_UPDATE_STATUSES.ERROR,
        progress: null,
        error: errorMessage(error),
      }));
    }
  }, [state.update]);

  const dismissUpdate = useCallback(() => {
    setState(INITIAL_UPDATE_STATE);
  }, []);

  const restartApp = useCallback(async () => {
    try {
      await relaunchApp();
    } catch (error) {
      setState((current) => ({
        ...current,
        status: APP_UPDATE_STATUSES.ERROR,
        error: errorMessage(error),
      }));
    }
  }, []);

  const busy = useMemo(
    () =>
      state.status === APP_UPDATE_STATUSES.CHECKING ||
      state.status === APP_UPDATE_STATUSES.DOWNLOADING,
    [state.status],
  );

  return {
    ...state,
    busy,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
    restartApp,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
