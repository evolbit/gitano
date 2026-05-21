## Why

Branch comparison local AI currently produces a shallow summary that repeats changed files and generic risk language, which is not useful when reviewing a branch before approving or commenting on a PR. Gitano needs two distinct AI-assisted branch workflows: a deeper analysis report for understanding branch risk, and a Copilot-style review pass that highlights changed code needing attention and turns those findings into actionable PR feedback.

## What Changes

- Split branch comparison AI into two user-facing actions:
  - Analyze branch: a deep branch-level report covering intent, risk, behavioral impact, test gaps, recommendations, and action items.
  - Review changed code: a line-anchored PR-review pass that finds potential bugs, regressions, unsafe assumptions, missing tests, and maintainability concerns in the diff.
- Remove the noisy changed-file chip list from branch analysis output; files are already visible in the comparison surface.
- Add branch review findings with changed-line anchors, severity, confidence, explanation, impact, recommendation, and suggested PR comment text.
- Render AI review findings in a way that lets the user inspect, edit, dismiss, copy, or apply them as draft review comments in the branch comparison modal.
- Reuse the commit-analysis progress timeline pacing model for branch analysis and branch review, using truthful branch-specific backend milestones.
- Prevent stale AI results or review findings from remaining active when the branch comparison inputs change.
- Keep all AI output local, cached by action and Git input, and non-mutating unless the user explicitly applies a finding as a draft comment.

## Capabilities

### New Capabilities
- `branch-ai-review`: Copilot-style local AI review of changed code in a branch comparison, including line-anchored findings and draft PR feedback workflows.

### Modified Capabilities
- `local-ai-git-analysis`: Branch analysis becomes a deeper report with recommendations and action items; local AI run progress applies to branch analysis and branch review in addition to commit analysis.
- `branch-comparison-review`: The branch comparison modal exposes separate Analyze and Review actions, clears stale AI state when comparison inputs change, and lets AI review findings become draft review comments.

## Impact

- Backend local AI action kinds, prompts, structured result parsing, cache keys, progress events, and branch Git context budgeting.
- Frontend local AI API types, branch comparison modal state, result rendering, progress timeline wiring, and review-thread integration.
- Existing branch comparison review comment models, which should support bot-authored draft comments without backend persistence.
- Tests for AI prompt/result parsing, progress events, stale-run handling, branch comparison modal behavior, and review-thread application.
