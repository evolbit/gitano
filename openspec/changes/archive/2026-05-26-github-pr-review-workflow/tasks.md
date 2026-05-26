## 1. Provider Integrations Settings

- [x] 1.1 Add backend provider integration types, provider catalog, and GitHub provider connection summary.
- [x] 1.2 Add backend commands to list provider integrations, start/complete GitHub OAuth, verify GitHub, and disconnect GitHub.
- [x] 1.3 Add secure credential storage abstraction for provider credentials and GitHub credential tests.
- [x] 1.4 Add frontend provider integration API adapter and typed request/response contracts.
- [x] 1.5 Add an `Integrations` section to settings with provider rows and GitHub OAuth connect/disconnect states.
- [x] 1.6 Add settings tests for disconnected, OAuth start/complete, connected, failed verification, and disconnect flows.

## 2. GitHub Repository And PR Backend

- [x] 2.1 Add GitHub remote parsing that resolves owner/repo from supported GitHub remote URL forms.
- [x] 2.2 Add GitHub API client helpers for authenticated requests, pagination, errors, and rate-limit metadata.
- [x] 2.3 Add backend command to load pending open pull request counts for a repository.
- [x] 2.4 Add backend command to list open pull requests with row data needed by the modal.
- [x] 2.5 Add backend command to prepare PR base/head refs for local comparison without checking out branches.
- [x] 2.6 Add backend command to load pull request conversation and review comments.
- [x] 2.7 Add backend command to submit GitHub reviews for `APPROVE`, `REQUEST_CHANGES`, and `COMMENT`.
- [x] 2.8 Add Rust tests for GitHub request construction, remote parsing, PR ref preparation, and review payload validation.

## 3. Pull Request Toolbar Entry

- [x] 3.1 Add frontend PR query keys and hooks for pending count refresh scoped by repository.
- [x] 3.2 Add regular count refresh while an eligible GitHub repository tab is active.
- [x] 3.3 Add a vertical divider and PR button with `PRs (n)` count to the repo toolbar.
- [x] 3.4 Ensure the PR button opens the pull request modal even while the count is loading or unavailable.
- [x] 3.5 Add toolbar tests for eligible repository, disconnected GitHub, count refresh, stale count, and modal opening states.

## 4. Pull Request List And Actions

- [x] 4.1 Create `src/features/pull-requests` with typed models, hooks, modal components, and tests.
- [x] 4.2 Build a dense pull request list modal with status, title, number, people, repository/branch context, and change counts.
- [x] 4.3 Add `Review`, `Approve`, and `Request changes` actions using GitHub-native naming.
- [x] 4.4 Add approve confirmation modal with Markdown composer and GitHub review submission.
- [x] 4.5 Add request changes confirmation modal with Markdown composer and GitHub review submission.
- [x] 4.6 Add modal states for GitHub disconnected, unsupported repository, loading, empty list, refresh failure, and submission failure.
- [x] 4.7 Add component tests for list rendering, action routing, confirmation submission, and failure feedback.

## 5. Pull Request Review Surface

- [x] 5.1 Extend the branch comparison modal with a pull request review mode and PR context props.
- [x] 5.2 Use prepared PR refs as comparison endpoints while preventing checkout side effects.
- [x] 5.3 Render pull request review header state with `Analyze`, `Review`, and `Comments` actions.
- [x] 5.4 Add a comments side panel that loads and displays PR conversation and review comments.
- [x] 5.5 Map loaded inline review comments to existing review thread anchors when possible.
- [x] 5.6 Map loaded file-level review comments to changed file headers when possible.
- [x] 5.7 Add tests for PR review mode, prepared refs, comments panel open/close, inline/file comment loading, and comment load failures.

## 6. Draft Comment Submission And AI Findings

- [x] 6.1 Add anchor validation and translation from Gitano review thread anchors to GitHub review comment payloads.
- [x] 6.2 Add comment-only review submission for draft review threads created in PR review mode.
- [x] 6.3 Add file-level draft comments and submit them through GitHub file-level review comment payloads.
- [x] 6.4 Preserve unsubmitted drafts when GitHub submission fails.
- [x] 6.5 Allow applied AI review findings to become editable draft PR comments in PR review mode.
- [x] 6.6 Ensure normal branch comparison AI review remains local-only and does not show GitHub submission controls.
- [x] 6.7 Add tests for applied AI findings, invalid anchors, line/file comment-only submission, and normal branch comparison behavior.
- [x] 6.8 Add draft editing support for loaded GitHub review comments and keep the file-level comment control visible when file comments are loaded.
- [x] 6.9 Preserve GitHub review reply relationships and submit draft replies through GitHub's reply endpoint.
- [x] 6.10 Add GitHub-backed resolve/reopen UI for review threads with collapsed resolved state.
- [x] 6.11 Move pull request review comment components, types, and utilities under `src/features/pull-requests`.

## 7. Verification

- [x] 7.1 Run focused frontend tests for settings, toolbar, pull request modal, branch comparison PR mode, and review comments.
- [x] 7.2 Run focused Rust tests for provider integrations, GitHub API helpers, PR refs, and review submission payloads.
- [x] 7.3 Run `pnpm run lint`.
- [x] 7.4 Run `pnpm test`.
- [x] 7.5 Run `pnpm run build`.
- [x] 7.6 Run `cargo test` from `src-tauri`.
- [x] 7.7 Run `openspec validate github-pr-review-workflow --strict`.
- [ ] 7.8 Manually verify the settings Integrations flow and PR review flow against a GitHub test repository.
