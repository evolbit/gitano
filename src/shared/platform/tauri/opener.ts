import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

export function revealPathInFileManager(path: string) {
  return revealItemInDir(path);
}

export function openExternalUrl(url: string) {
  return openUrl(url);
}
