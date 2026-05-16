import { invokeCommand } from "@/shared/platform/tauri/command";
import { openDirectoryDialog } from "@/shared/platform/tauri/dialog";

export async function openLocalRepository(path: string) {
  return invokeCommand<string>("open_local_repo", { path });
}

export async function openLocalRepoDialog(): Promise<string | null> {
  const selected = await openDirectoryDialog();
  if (!selected) return null;

  try {
    const response = await openLocalRepository(selected);
    return response.startsWith("Repositorio abierto correctamente")
      ? selected
      : null;
  } catch {
    return null;
  }
}
