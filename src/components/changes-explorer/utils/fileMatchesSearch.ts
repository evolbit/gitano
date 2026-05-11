import { ChangesExplorerFile } from "../../../utils/changesExplorerTree";

export function fileMatchesSearch(file: ChangesExplorerFile, search: string) {
  if (!search) return true;
  return file.path.toLowerCase().includes(search.toLowerCase());
}
