import { LazyStore } from "@tauri-apps/plugin-store";
import type { StateStorage } from "zustand/middleware";

export function createTauriStateStorage(storageFile = ".storage.json") {
  const store = new LazyStore(storageFile);

  return {
    getItem: async (name: string): Promise<string | null> => {
      const value = await store.get<string>(name);
      return value ?? null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await store.set(name, value);
      await store.save();
    },
    removeItem: async (name: string): Promise<void> => {
      await store.delete(name);
      await store.save();
    },
  } satisfies StateStorage;
}

export const tauriStorage = createTauriStateStorage();
