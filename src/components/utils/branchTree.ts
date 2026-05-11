export type BranchTreeNode =
  | {
      type: "branch";
      name: string;
      full: string;
    }
  | {
      type: "group";
      name: string;
      full: string;
      children: BranchTreeNode[];
    };

export function groupBranches(branches: string[]): BranchTreeNode[] {
  const tree: Record<string, unknown> = {};

  branches.forEach((branch) => {
    const parts = branch.split("/");
    let current: Record<string, unknown> = tree;

    parts.forEach((part, idx) => {
      if (!(part in current)) {
        current[part] = idx === parts.length - 1 ? null : {};
      }

      if (idx < parts.length - 1) {
        current = current[part] as Record<string, unknown>;
      }
    });
  });

  function toArray(obj: Record<string, unknown>, prefix = ""): BranchTreeNode[] {
    return Object.entries(obj).map(([key, value]) => {
      const full = prefix ? `${prefix}/${key}` : key;

      if (value === null) {
        return { type: "branch", name: key, full };
      }

      return {
        type: "group",
        name: key,
        full,
        children: toArray(value as Record<string, unknown>, full),
      };
    });
  }

  return toArray(tree);
}
