import type {
  ChangesExplorerFile,
  ChangesExplorerTreeNode,
} from "@/shared/lib/tree/changes-explorer-tree";

export function getTreeDescendants(
  node: ChangesExplorerTreeNode,
): ChangesExplorerFile[] {
  if (node.kind === "file") return [node.file];
  return node.children.flatMap((child) => getTreeDescendants(child));
}
