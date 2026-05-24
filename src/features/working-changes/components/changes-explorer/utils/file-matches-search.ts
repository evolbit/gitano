import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";

export function fileMatchesSearch(file: ChangesExplorerFile, search: string) {
  if (!search) return true;
  return file.path.toLowerCase().includes(search.toLowerCase());
}
