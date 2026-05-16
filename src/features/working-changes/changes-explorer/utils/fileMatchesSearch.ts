import type { ChangesExplorerFile } from "@/shared/lib/tree/changesExplorerTree";

export function fileMatchesSearch(file: ChangesExplorerFile, search: string) {
  if (!search) return true;
  return file.path.toLowerCase().includes(search.toLowerCase());
}
