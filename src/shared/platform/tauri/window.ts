import {
  LogicalPosition,
  LogicalSize,
  getCurrentWindow,
} from "@tauri-apps/api/window";

export function getAppWindow() {
  return getCurrentWindow();
}

export function createLogicalSize(width: number, height: number) {
  return new LogicalSize(width, height);
}

export function createLogicalPosition(x: number, y: number) {
  return new LogicalPosition(x, y);
}
