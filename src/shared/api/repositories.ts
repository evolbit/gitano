import { invokeCommand } from "@/shared/platform/tauri/command";
import { openDirectoryDialog } from "@/shared/platform/tauri/dialog";
import type { RepositoryState } from "@/shared/types/git";

export async function openLocalRepository(path: string) {
  return invokeCommand<string>("open_local_repo", { path });
}

export async function initLocalRepository(path: string) {
  return invokeCommand<string>("init_local_repo", { path });
}

export async function getRepositoryState(path: string) {
  return invokeCommand<RepositoryState>("get_repository_state", { path });
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

export async function initLocalRepoDialog(): Promise<string | null> {
  const selected = await openDirectoryDialog();
  if (!selected) return null;

  try {
    const response = await initLocalRepository(selected);
    return response.startsWith("Repositorio creado correctamente")
      ? selected
      : null;
  } catch {
    return null;
  }
}
