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

function matchesBranchAlias(name: string, aliases: string[]) {
  const lowerName = name.toLowerCase();
  return aliases.some((alias) => {
    if (lowerName === alias) return true;
    return (
      lowerName.startsWith(`${alias}-`) ||
      lowerName.startsWith(`${alias}_`) ||
      lowerName.startsWith(`${alias}.`)
    );
  });
}

export function getBranchPriority(name: string) {
  if (
    matchesBranchAlias(name, [
      "develop",
      "dev",
      "development",
      "developing",
    ])
  ) {
    return 0;
  }

  if (
    matchesBranchAlias(name, ["main", "master", "production", "prod", "live"])
  ) {
    return 1;
  }

  if (
    matchesBranchAlias(name, ["stage", "staging", "uat", "preprod", "qa"])
  ) {
    return 2;
  }

  return 99;
}

export function isPriorityBranchName(name: string) {
  return getBranchPriority(name) < 99;
}

function sortBranchNodes(nodes: BranchTreeNode[]) {
  return [...nodes].sort((left, right) => {
    const leftPriority = getBranchPriority(left.name);
    const rightPriority = getBranchPriority(right.name);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.name.localeCompare(right.name);
  });
}

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
        children: sortBranchNodes(
          toArray(value as Record<string, unknown>, full),
        ),
      };
    });
  }

  return sortBranchNodes(toArray(tree));
}
