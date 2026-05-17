import { ChangesExplorerStagedLinesState } from "./types";

export function cloneStagedLinesState(
  stagedLines: ChangesExplorerStagedLinesState,
) {
  return Object.fromEntries(
    Object.entries(stagedLines).map(([filePath, fileSelection]) => [
      filePath,
      Object.fromEntries(
        Object.entries(fileSelection as Record<string, unknown>).map(
          ([key, value]) => [
            key,
            value instanceof Set ? new Set(value) : value,
          ],
        ),
      ),
    ]),
  ) as typeof stagedLines;
}
