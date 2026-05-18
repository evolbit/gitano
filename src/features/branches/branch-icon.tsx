import { IconGitBranch } from "@/components/icons";
import { isPriorityBranchName } from "@/shared/lib/tree/branch-tree";
import {
  DEFAULT_BRANCH_ICON_COLOR,
  PRIORITY_BRANCH_COLOR,
} from "./constants";

export function BranchIcon({ name }: { name: string }) {
  const priority = isPriorityBranchName(name);

  return (
    <span className="inline-flex h-4 w-4 items-center justify-center">
      <IconGitBranch
        size={15}
        className={priority ? PRIORITY_BRANCH_COLOR : DEFAULT_BRANCH_ICON_COLOR}
      />
    </span>
  );
}
