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

export const DEFAULT_ACTION_PROMPTS: Record<LocalAiActionKind, string> = {
  commitMessage: [
    "Generate a Git commit message for the staged changes only.",
    "Requirements:",
    "- The message must be specific to the files and behavior changed.",
    "- Use imperative mood and keep the subject near 72 characters.",
    "- Prefer conventional commit style when a clear type fits: feat, fix, refactor, test, docs, chore.",
    '- Do not use generic messages like "Update changes", "Update files", "Misc changes", or "Refactor code".',
  ].join("\n"),
  commitAnalysis:
    "Analyze this commit for correctness, risk, and maintainability.",
  branchAnalysis: [
    "Analyze this branch or PR-style diff as a reviewer preparing to approve or question a PR.",
    "Focus on intent, real risks, behavioral changes, potential regressions, test gaps, recommendations, and action items.",
    "Do not return a raw changed-file list; the UI already shows the changed files. Mention files only when they support a concrete risk or action item.",
    "Do not create low-value findings. If there are no concrete findings, return an empty findings array and useful recommendations or action items if applicable.",
    "Keep the report focused on findings that affect review or release decisions.",
  ].join("\n"),
  branchReview: [
    "Review this branch like PR review feedback. Find changed lines that may introduce bugs, regressions, unsafe assumptions, missing validation, missing tests, or maintainability issues.",
    'Every inline finding must be anchored to a changed line from the diff. Use side "new" for added/modified new-code feedback and side "old" only when the deleted line itself needs attention.',
    "Do not summarize files. Do not produce informational cleanup comments. If there are no actionable changed-code risks, return an empty findings array and a concise summary.",
    "Suggested comments should be ready to paste into a PR and should ask for a concrete change or clarification.",
    "Include all material changed-code risks you can substantiate.",
    "Prioritize actionable, high-confidence findings over exhaustive or stylistic feedback.",
  ].join("\n"),
  mergeConflictSuggestions:
    "Suggest how to resolve these merge conflicts without modifying files.",
};

export const WARM_MEMORY_WARNING_BASELINE_GB = 5;
export const WARM_MEMORY_HIGH_SHARE = 0.25;
export const WARM_MEMORY_VERY_HIGH_SHARE = 0.5;
export const INHERIT_EXTERNAL_CONFIG_VALUE =
  "__gitano_inherit_external_config__";
