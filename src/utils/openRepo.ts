import { core } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";

export async function openLocalRepoDialog(): Promise<string | null> {
  const selected = await open({ directory: true });
  if (selected && typeof selected === "string") {
    try {
      const res = await core.invoke<string>("open_local_repo", {
        path: selected,
      });
      if (res.startsWith("Repositorio abierto correctamente")) {
        return selected;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  return null;
}
