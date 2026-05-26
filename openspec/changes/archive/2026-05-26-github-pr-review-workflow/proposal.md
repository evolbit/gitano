## Why

Gitano already supports local branch comparison, inline draft review comments, and AI review findings, but pull request review still requires leaving the app. Adding GitHub pull request review brings the common GitHub workflow into the same workspace where users inspect branches, review diffs, and run local AI feedback.

## What Changes

- Add a GitHub pull request entry point to the repository toolbar, separated from the existing Git action icons by a vertical divider.
- Show the pending pull request count in the toolbar button label, for example `PRs (3)`.
- Refresh the pending pull request count regularly for each active repository tab and refresh it after PR review actions complete.
- Add an `Integrations` section to settings with provider rows, starting with GitHub.
- Connect GitHub from settings through GitHub OAuth device authorization, then verify and disconnect the provider from settings so PR workflows use the configured integration instead of prompting ad hoc from PR surfaces.
- Add a pull request list modal for GitHub remotes using GitHub-native terminology and actions.
- Present pull request actions as `Review`, `Approve`, and `Request changes`.
- Open `Approve` and `Request changes` confirmation modals with a Markdown comment composer.
- Reuse the branch comparison review surface for pull request review, configured with the PR base/head context.
- In pull request review mode, expose top-right actions for `Analyze`, `Review`, and `Comments`.
- Add a pull request comments side panel in the review view for loading existing PR discussion and review comments.
- Allow user-selected draft review comments, including applied AI findings, to be submitted to GitHub as pull request review feedback.
- Surface GitHub authentication, permission, and rate-limit failures in the same compact error style used by existing workspace actions.

## Capabilities

### New Capabilities

- `github-pr-review-workflow`: Lists GitHub pull requests for the active repository, opens PR review flows, loads PR comments, and submits GitHub-native review decisions.
- `provider-integrations-settings`: Presents provider integrations in settings and manages provider connection state, starting with GitHub.

### Modified Capabilities

- `workspace-toolbar-polish`: Adds a pull request toolbar entry point with a regularly refreshed pending count.
- `branch-comparison-review`: Adds pull request review mode, comments side panel behavior, and PR-backed persistence for review comments.
- `branch-ai-review`: Allows user-selected AI review findings to become GitHub pull request review comments in PR review mode while preserving local, non-mutating behavior for normal branch comparisons.

## Impact

- Frontend: repository toolbar, PR list modal, PR confirmation modals, branch comparison modal, comments side panel, React Query hooks, and review comment components.
- Backend: new Tauri commands for GitHub repository detection, PR listing, PR comment loading, PR review submission, and PR ref preparation.
- Settings: new Integrations section with provider connection state, connection actions, and extensible provider metadata.
- Credentials: GitHub OAuth access must be stored through secure provider integration storage rather than repository state or frontend-only persistence.
- Git: local branch comparison must be able to compare GitHub PR base/head refs without changing the user's checked-out branch.
- GitHub API: requires authenticated requests for private repositories and write actions such as approve, request changes, and review comments.
- State and refresh: pending PR counts must be cached per repository tab and periodically refreshed without blocking primary Git workflows.
- Tests: Rust command/unit tests for GitHub request construction and ref handling; frontend tests for toolbar count, modal actions, comment submission, and PR review mode.
