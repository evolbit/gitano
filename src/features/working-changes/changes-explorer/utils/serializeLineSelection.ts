export function serializeLineSelection(
  selection: Record<number, Set<number>> | undefined,
): Record<number, number[]> {
  const hunks: Record<number, number[]> = {};

  if (!selection) return hunks;

  Object.entries(selection).forEach(([hunkIdx, lineSet]) => {
    if (!(lineSet instanceof Set) || lineSet.size === 0) return;
    hunks[Number(hunkIdx)] = Array.from(lineSet).sort((a, b) => a - b);
  });

  return hunks;
}
