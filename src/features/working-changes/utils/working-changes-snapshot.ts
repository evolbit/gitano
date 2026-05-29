import {
  DiffHunk,
  DiffLine,
  FileChangeWithHunks,
  StagedFileSelectionState,
} from "@/shared/types/git";

function buildLineSignature(line: DiffLine) {
  return `${line.kind}:${line.old_lineno ?? ""}:${line.new_lineno ?? ""}:${line.content}`;
}

function buildHunkSignature(hunk: DiffHunk) {
  return [
    hunk.header,
    hunk.old_start,
    hunk.old_lines,
    hunk.new_start,
    hunk.new_lines,
    hunk.is_new_file ? 1 : 0,
    hunk.lines.length,
    hunk.lines.map(buildLineSignature).join("|"),
  ].join(":");
}

export function buildWorkingChangeFileSignature(file: FileChangeWithHunks) {
  return [
    file.path,
    file.status,
    file.insertions,
    file.deletions,
    file.hunks.length,
    file.hunks.map(buildHunkSignature).join("~"),
  ].join("|");
}

export function buildWorkingChangesFileSnapshotSignature(
  files: FileChangeWithHunks[],
) {
  return files
    .map(buildWorkingChangeFileSignature)
    .join("||");
}

export function buildWorkingChangesStagedSnapshotSignature(
  stagedStateByFile: Record<string, StagedFileSelectionState>,
) {
  return Object.entries(stagedStateByFile)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, hunks]) =>
      [
        filePath,
        hunks.isNewFile ? 1 : 0,
        hunks.isWholeFileStaged ? 1 : 0,
        hunks.isPartiallyStaged ? 1 : 0,
        Object.entries(hunks.hunks)
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(([hunkIdx, lineIdxs]) => [hunkIdx, lineIdxs.join(",")].join(":"))
          .join("~"),
      ].join("|"),
    )
    .join("||");
}

export function mergeWorkingChangesPreservingIdentity(
  previous: FileChangeWithHunks[],
  next: FileChangeWithHunks[],
) {
  if (previous.length === 0) return next;

  const previousByPath = new Map(
    previous.map((file) => [file.path, file] as const),
  );
  const previousSignatureByPath = new Map(
    previous.map((file) => [file.path, buildWorkingChangeFileSignature(file)]),
  );

  const merged = next.map((file) => {
    const previousSignature = previousSignatureByPath.get(file.path);
    if (!previousSignature) return file;

    return previousSignature === buildWorkingChangeFileSignature(file)
      ? previousByPath.get(file.path) ?? file
      : file;
  });

  const unchanged =
    previous.length === merged.length &&
    previous.every((file, index) => file === merged[index]);

  return unchanged ? previous : merged;
}
