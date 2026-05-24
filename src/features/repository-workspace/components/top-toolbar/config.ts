import type { PullStrategyOption, PushModeOption } from "./types";

export const TOOLBAR_DROPDOWN_RESULTS_MAX_HEIGHT = "80vh";
export const TOOLBAR_SELECTOR_DROPDOWN_PANEL_WIDTH = 420;
export const GIT_ACTION_SUCCESS_SNACKBAR_MS = 3200;
export const GIT_ACTION_ERROR_SNACKBAR_MS = 8000;
export const TOOLBAR_DROPDOWN_ITEM_CLASS =
  "px-4 py-2 transition-colors hover:!bg-zinc-800 focus:!bg-zinc-800 data-[hovered=true]:!bg-zinc-800";

export const PULL_STRATEGIES: PullStrategyOption[] = [
  { value: "fetch-all", label: "Fetch All + Tags" },
  { value: "fetch-all-prune", label: "Fetch All + Tags + Prune" },
  {
    value: "pull-ff-if-possible",
    label: "Pull (fast-forward if possible)",
  },
  { value: "pull-ff-only", label: "Pull (fast-forward only)" },
  { value: "pull-rebase", label: "Pull (rebase)" },
];

export const PUSH_MODES: PushModeOption[] = [
  { value: "push-branch", label: "Push current branch" },
  { value: "push-branch-and-tags", label: "Push current branch with tags" },
];
