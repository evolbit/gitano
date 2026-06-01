import { open } from "@tauri-apps/plugin-dialog";

export async function openDirectoryDialog(defaultPath?: string): Promise<string | null> {
  const selected = await open({ directory: true, defaultPath });
  return typeof selected === "string" ? selected : null;
}

export async function openLicenseFileDialog(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Gitano license", extensions: ["gitano-license", "json"] }],
  });
  return typeof selected === "string" ? selected : null;
}
