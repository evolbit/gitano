import type {
  PullRequestMergeMethod,
  RepositoryMergeOptions,
} from "@/shared/api/integrations";

export type MergeMethodOption = {
  method: PullRequestMergeMethod;
  label: string;
  description: string;
  enabled: (options: RepositoryMergeOptions) => boolean;
};

export const MERGE_METHOD_OPTIONS: MergeMethodOption[] = [
  {
    method: "merge",
    label: "Create a merge commit",
    description:
      "All commits from this branch will be added to the base branch via a merge commit.",
    enabled: (options) => options.mergeCommit,
  },
  {
    method: "squash",
    label: "Squash and merge",
    description:
      "The commits from this branch will be added to the base branch as a single commit.",
    enabled: (options) => options.squash,
  },
  {
    method: "rebase",
    label: "Rebase and merge",
    description:
      "The commits from this branch will be rebased and added to the base branch.",
    enabled: (options) => options.rebase,
  },
];

export function enabledMergeMethods(options: RepositoryMergeOptions | null) {
  if (!options) return MERGE_METHOD_OPTIONS;

  const enabled = MERGE_METHOD_OPTIONS.filter((option) =>
    option.enabled(options),
  );
  return enabled.length > 0 ? enabled : MERGE_METHOD_OPTIONS;
}

export function mergeMethodLabel(method: PullRequestMergeMethod) {
  return (
    MERGE_METHOD_OPTIONS.find((option) => option.method === method)?.label ??
    "Create a merge commit"
  );
}
