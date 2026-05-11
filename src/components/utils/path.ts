export function getFileName(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

export function getParentPath(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function getAncestorFolderPaths(path: string) {
  const parts = path.split("/");
  const ancestors: string[] = [];

  for (let index = 1; index < parts.length; index += 1) {
    ancestors.push(parts.slice(0, index).join("/"));
  }

  return ancestors;
}
