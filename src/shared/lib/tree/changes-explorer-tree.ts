import {
  DiffLine,
  FileChange,
  FileChangeWithHunks,
  WorkingChangeFileSummary,
} from "@/shared/types/git";
import { ChangeType } from "@/shared/types/git";
import type { GitConflictSummary } from "@/shared/types/git-conflicts";

export type ChangesExplorerConflictFile = Omit<FileChange, "status"> &
  Partial<Omit<GitConflictSummary, "path" | "status">> & {
    status: ChangeType.Conflicted;
    isUntracked?: false;
  };

export type ChangesExplorerFile =
  | FileChange
  | FileChangeWithHunks
  | WorkingChangeFileSummary
  | ChangesExplorerConflictFile;

export type ChangesExplorerTreeNode =
  | {
      kind: "folder";
      name: string;
      path: string;
      children: ChangesExplorerTreeNode[];
      files: ChangesExplorerFile[];
    }
  | {
      kind: "file";
      file: ChangesExplorerFile;
      path: string;
      name: string;
    };

type TreeFolderNode = {
  kind: "folder";
  name: string;
  path: string;
  children: Map<string, TreeNodeRecord>;
};

type TreeFileNode = {
  kind: "file";
  file: ChangesExplorerFile;
  path: string;
  name: string;
};

type TreeNodeRecord = TreeFolderNode | TreeFileNode;

export function buildCompressedTree(
  files: ChangesExplorerFile[],
): ChangesExplorerTreeNode[] {
  const root = new Map<string, TreeNodeRecord>();

  files.forEach((file) => {
    const parts = file.path.split("/");
    let current = root;

    parts.forEach((part: string, index: number) => {
      const isLeaf = index === parts.length - 1;
      const existing = current.get(part);

      if (isLeaf) {
        current.set(part, {
          kind: "file",
          file,
          path: file.path,
          name: part,
        });
        return;
      }

      if (!existing || existing.kind !== "folder") {
        const next: TreeFolderNode = {
          kind: "folder",
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          children: new Map<string, TreeNodeRecord>(),
        };
        current.set(part, next);
        current = next.children;
        return;
      }

      current = existing.children;
    });
  });

  const toNodes = (map: Map<string, TreeNodeRecord>): ChangesExplorerTreeNode[] =>
    Array.from(map.values())
      .map((entry: TreeNodeRecord): ChangesExplorerTreeNode => {
        if (entry.kind === "file") {
          return entry;
        }

        const folderChildren = toNodes(entry.children);
        let name = entry.name;
        let path = entry.path;
        let children = folderChildren;

        while (children.length === 1 && children[0].kind === "folder") {
          const child = children[0];
          name = `${name}/${child.name}`;
          path = child.path;
          children = child.children;
        }

        return {
          kind: "folder" as const,
          name,
          path,
          children,
          files: collectFilesFromTree(children),
        };
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

  return toNodes(root);
}

export function collectFolderPaths(
  nodes: ChangesExplorerTreeNode[],
  acc = new Set<string>(),
) {
  nodes.forEach((node) => {
    if (node.kind !== "folder") return;
    acc.add(node.path);
    collectFolderPaths(node.children, acc);
  });
  return acc;
}

export function collectFilesFromTree(
  nodes: ChangesExplorerTreeNode[],
): ChangesExplorerFile[] {
  return nodes.flatMap((node) =>
    node.kind === "file" ? [node.file] : node.files,
  );
}

export function buildAllStageableLineMap(file: ChangesExplorerFile) {
  if (!("hunks" in file)) return {};

  const allHunks: Record<number, number[]> = {};

  file.hunks.forEach((hunk, hunkIdx) => {
    const lineIdxs = hunk.lines
      .map((line: DiffLine, idx: number) =>
        line.kind === "Add" || line.kind === "Del" ? idx : null,
      )
      .filter((lineIdx) => lineIdx !== null) as number[];

    if (lineIdxs.length > 0) {
      allHunks[hunkIdx] = lineIdxs;
    }
  });

  return allHunks;
}
