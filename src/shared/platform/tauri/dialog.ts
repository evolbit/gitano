import { open } from "@tauri-apps/plugin-dialog";

export async function openDirectoryDialog(defaultPath?: string): Promise<string | null> {
  const selected = await open({ directory: true, defaultPath });
  return typeof selected === "string" ? selected : null;
}
