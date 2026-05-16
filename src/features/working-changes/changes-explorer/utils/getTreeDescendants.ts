import type {
  ChangesExplorerFile,
  ChangesExplorerTreeNode,
} from "@/shared/lib/tree/changesExplorerTree";

export function getTreeDescendants(
  node: ChangesExplorerTreeNode,
): ChangesExplorerFile[] {
  if (node.kind === "file") return [node.file];
  return node.children.flatMap((child) => getTreeDescendants(child));
}
