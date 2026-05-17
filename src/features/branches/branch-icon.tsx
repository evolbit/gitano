import { IconGitBranch } from "@/components/icons";
import { isPriorityBranchName } from "@/shared/lib/tree/branch-tree";
import {
  DEFAULT_BRANCH_ICON_COLOR,
  PRIORITY_BRANCH_COLOR,
} from "./constants";

export function BranchIcon({ name }: { name: string }) {
  const priority = isPriorityBranchName(name);

  return (
    <span className="inline-flex h-5 w-5 items-center justify-center">
      <IconGitBranch
        size={18}
        className={priority ? PRIORITY_BRANCH_COLOR : DEFAULT_BRANCH_ICON_COLOR}
      />
    </span>
  );
}
