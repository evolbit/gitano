import { revealItemInDir } from "@tauri-apps/plugin-opener";

export function revealPathInFileManager(path: string) {
  return revealItemInDir(path);
}
