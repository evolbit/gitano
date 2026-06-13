import type { LocalAiActionKind } from "@/shared/api/local-ai";
import type { SettingsPane } from "./types";

export const AI_PANES: ReadonlyArray<{ key: SettingsPane; label: string }> = [
  { key: "runtime", label: "Runtime" },
  { key: "models", label: "Local Models" },
  { key: "externalAgents", label: "External Agents" },
  { key: "configuration", label: "Configuration" },
];

export const INTEGRATION_PANES: ReadonlyArray<{
  key: SettingsPane;
  label: string;
}> = [{ key: "integrations", label: "Integrations" }];

export const PANE_TITLES: Record<SettingsPane, string> = {
  runtime: "Runtime",
  models: "Local Models",
  externalAgents: "External Agents",
  configuration: "Configuration",
  integrations: "Integrations",
};

export const ACTIONS: ReadonlyArray<{
  kind: LocalAiActionKind;
  label: string;
  description: string;
}> = [
  {
    kind: "commitMessage",
    label: "Commit",
    description: "Generate commit messages from staged changes.",
  },
  {
    kind: "commitAnalysis",
    label: "Commit review",
    description: "Analyze committed changes.",
  },
  {
    kind: "branchAnalysis",
    label: "Branch analysis",
    description: "Analyze branch risk before opening a PR.",
  },
  {
    kind: "branchReview",
    label: "Branch review",
    description: "Review changed lines before opening a PR.",
  },
  {
    kind: "mergeConflictSuggestions",
    label: "Merge conflicts",
    description: "Suggest conflict resolution steps.",
  },
];

export const WARM_MEMORY_WARNING_BASELINE_GB = 5;
export const WARM_MEMORY_HIGH_SHARE = 0.25;
export const WARM_MEMORY_VERY_HIGH_SHARE = 0.5;
export const INHERIT_EXTERNAL_CONFIG_VALUE =
  "__gitano_inherit_external_config__";
