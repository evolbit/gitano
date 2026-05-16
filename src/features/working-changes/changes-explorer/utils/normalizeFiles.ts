import type { ChangesExplorerFile } from "@/shared/lib/tree/changesExplorerTree";
import { normalizeStatus } from "./normalizeStatus";

export function normalizeFiles(files: ChangesExplorerFile[]): ChangesExplorerFile[] {
  return files.map((file) => ({
    ...file,
    status: normalizeStatus(file.status),
  }));
}
