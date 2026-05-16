import type { BranchTreeNode } from "../../../utils/branchTree";
import type { BranchType } from "../types";

export function stripEdgeSlashes(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function buildBranchName(prefix: string, name: string) {
  const cleanPrefix = prefix.replace(/^\/+/, "").replace(/\/+$/, "");
  const cleanName = stripEdgeSlashes(name);

  if (!cleanName) return "";
  if (!cleanPrefix) return cleanName;

  return `${cleanPrefix}/${cleanName}`;
}

export function stripRemotePrefix(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(1).join("/");
}

export function getBranchCreatePrefix(
  node: BranchTreeNode,
  branchType: BranchType,
) {
  const localPath = branchType === "remote" ? stripRemotePrefix(node.full) : node.full;

  if (!localPath) return "";

  if (node.type === "group") {
    return `${stripEdgeSlashes(localPath)}/`;
  }

  const lastSlash = localPath.lastIndexOf("/");
  return lastSlash >= 0 ? `${localPath.slice(0, lastSlash)}/` : "";
}
