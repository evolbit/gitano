import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { normalizeStatus } from "./normalize-status";

export function normalizeFiles(files: ChangesExplorerFile[]): ChangesExplorerFile[] {
  return files.map((file) => ({
    ...file,
    status: normalizeStatus(file.status),
  }));
}
