import { ChangesExplorerFile, ChangesExplorerTreeNode } from "../../../utils/changesExplorerTree";

export function getTreeDescendants(
  node: ChangesExplorerTreeNode,
): ChangesExplorerFile[] {
  if (node.kind === "file") return [node.file];
  return node.children.flatMap((child) => getTreeDescendants(child));
}
