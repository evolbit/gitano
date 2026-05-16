import type { ChangesExplorerFile } from "@/shared/lib/tree/changesExplorerTree";
import { ChangesExplorerCheckboxState } from "./types";

export function getFolderCheckboxState(
  filesInFolder: ChangesExplorerFile[],
  getCheckboxState: (
    file: ChangesExplorerFile,
  ) => ChangesExplorerCheckboxState,
): ChangesExplorerCheckboxState {
  if (filesInFolder.length === 0) return "unchecked" as const;

  const checkedCount = filesInFolder.filter(
    (file) => getCheckboxState(file) === "checked",
  ).length;

  if (checkedCount === 0) return "unchecked" as const;
  if (checkedCount === filesInFolder.length) return "checked" as const;
  return "indeterminate" as const;
}
