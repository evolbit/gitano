export const APP_UPDATE_STATUSES = {
  IDLE: "idle",
  CHECKING: "checking",
  UNAVAILABLE: "unavailable",
  AVAILABLE: "available",
  DOWNLOADING: "downloading",
  READY_TO_RESTART: "readyToRestart",
  ERROR: "error",
} as const;

export type AppUpdateStatus =
  (typeof APP_UPDATE_STATUSES)[keyof typeof APP_UPDATE_STATUSES];
