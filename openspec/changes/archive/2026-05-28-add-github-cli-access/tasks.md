## 1. Backend Access Model

- [x] 1.1 Add GitHub access method types for `oauth`, `ghCli`, and `autoFallback`.
- [x] 1.2 Persist the selected GitHub access method in provider integration settings.
- [x] 1.3 Add a typed GitHub PR client boundary used by existing GitHub Tauri commands.
- [x] 1.4 Keep the current OAuth implementation behind an OAuth GitHub PR client.

## 2. GitHub CLI Detection

- [x] 2.1 Add backend detection for `gh --version`.
- [x] 2.2 Add backend authentication check for `gh auth status -h github.com`.
- [x] 2.3 Add backend identity verification through `gh api user`.
- [x] 2.4 Return GitHub CLI status, version, account identity, and actionable errors in provider integration summaries.
- [x] 2.5 Add Rust tests for installed, missing, unauthenticated, and ready `gh` states using a mock process runner.
- [x] 2.6 Resolve `gh` through platform fallback paths so bundled macOS apps can find Homebrew installs.

## 3. GitHub CLI PR Client

- [x] 3.1 Add a structured `gh` process runner that uses explicit args and optional stdin, never shell command strings.
- [x] 3.2 Implement PR listing and counting through `gh`.
- [x] 3.3 Implement PR comment loading through `gh api`, including review comments and review thread metadata.
- [x] 3.4 Implement approve, request-changes, comment-only review submission, inline comments, file-level comments, replies, and edits through `gh`.
- [x] 3.5 Implement review thread resolve/reopen through `gh api graphql`.
- [x] 3.6 Add tests for JSON parsing, command construction, error mapping, and operation parity.

## 4. Access Method Routing

- [x] 4.1 Route GitHub PR commands through the selected access method.
- [x] 4.2 In `autoFallback`, retry through `gh` only for known OAuth access-policy failures.
- [x] 4.3 Include the access method used in backend errors and success metadata where useful for debugging.
- [x] 4.4 Ensure GitHub CLI-only mode never starts OAuth and never requires a stored OAuth token.

## 5. Settings UI

- [x] 5.1 Add a GitHub access method selector to `Settings > Integrations`.
- [x] 5.2 Show OAuth connection state separately from GitHub CLI availability.
- [x] 5.3 Show `gh` not installed, installed but unauthenticated, and ready states with actionable text.
- [x] 5.4 Disable or explain PR actions when the selected access method is unavailable.
- [x] 5.5 Add frontend tests for access method selection and GitHub CLI states.

## 6. Verification

- [x] 6.1 Run focused Rust tests for GitHub integration routing and `gh` command construction.
- [x] 6.2 Run focused frontend tests for integration settings.
- [x] 6.3 Run `cargo test` from `src-tauri`.
- [x] 6.4 Run `pnpm run lint`.
- [x] 6.5 Run `pnpm test`.
- [x] 6.6 Run `pnpm run build`.
- [x] 6.7 Run `openspec validate add-github-cli-access --strict`.

## 7. Provider Boundary Cleanup

- [x] 7.1 Split the GitHub CLI backend into focused runner, status, API, PR operation, review-thread, and wire-mapping modules.
- [x] 7.2 Add provider-neutral pull request command wrappers that currently route `github` to the GitHub provider.
- [x] 7.3 Move pull request frontend calls to provider-neutral adapters using `providerId: "github"`.
- [x] 7.4 Split the pull request modal into local feature components and helpers.
- [x] 7.5 Re-run focused backend and frontend tests after the cleanup.
- [x] 7.6 Re-run broad lint/build checks after the cleanup.

## 8. Merge Method Confirmation

- [x] 8.1 Pass merge commit title and description through provider-neutral, OAuth, and `gh` merge paths.
- [x] 8.2 Load PR body text so squash/merge confirmations can prefill GitHub-style commit descriptions.
- [x] 8.3 Show method-specific confirmations: editable merge message, editable squash message, and compact rebase confirmation.
- [x] 8.4 Add focused frontend and backend tests for merge message payloads and `gh` merge arguments.
- [x] 8.5 Load PR commits on demand and use the commit headline list as the squash extended description.
- [x] 8.6 Reuse the same merge dropdown and confirmation flow in the pull request list and pull request review screen.

## 9. Pull Request Review Submission

- [x] 9.1 Replace direct submit-comments behavior with an explicit finish-review dropdown.
- [x] 9.2 Support comment-only, approve, and request-changes review events through the selected access method.
- [x] 9.3 Require a summary body for request-changes review submission.
- [x] 9.4 Disable approve and request-changes review decisions when the current GitHub account authored the pull request.
- [x] 9.5 Keep merge available for authored pull requests because GitHub controls merge eligibility separately.
- [x] 9.6 Refresh and keep newly submitted review comments visible after GitHub accepts the review.
