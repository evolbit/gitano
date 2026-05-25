## Context

Gitano already has the local pieces needed for a strong pull request review experience: branch comparison, changed-file navigation, diff rendering, inline draft comments, a Markdown composer, and local AI analysis/review actions. What is missing is a provider integration layer that can authenticate with GitHub, list pull requests for the active repository, prepare PR refs for local comparison, load PR comments, and submit GitHub review decisions.

Settings currently focus on AI engines. GitHub should not be configured ad hoc from the PR modal because provider connection state is cross-cutting and will eventually apply to more than pull requests. A new settings section named `Integrations` should own provider connection state. GitHub is the first provider row, but the model should be provider-based from the beginning.

## Goals / Non-Goals

**Goals:**

- Add a provider integration model that supports GitHub now and can add other providers later.
- Put GitHub OAuth connection, verification, and disconnection in settings under `Integrations`.
- Add a repository toolbar PR entry point with a regularly refreshed pending count.
- List GitHub pull requests for the active repository and use GitHub-native labels: `Review`, `Approve`, and `Request changes`.
- Reuse the existing branch comparison modal for PR review mode.
- Load PR comments in a comments side panel and allow local draft comments to be submitted as GitHub review feedback.
- Keep PR count refresh lightweight and non-blocking.

**Non-Goals:**

- Supporting non-GitHub providers in this change.
- Merging pull requests.
- Creating or editing pull requests.
- Implementing full GitHub issue management, labels, milestones, checks, or project fields.
- Persisting branch-comparison draft comments outside a PR review submission.
- Replacing local AI branch comparison behavior for non-PR comparisons.

## Decisions

### Use `Integrations` as the settings section name

The settings sidebar should add an `Integrations` section with provider rows. The first row is GitHub and shows provider status, account identity when connected, and connect/disconnect actions.

Alternatives considered:
- `Providers`: accurate, but less user-facing and easy to confuse with AI model providers.
- `Accounts`: too narrow because future integrations may include provider features beyond identity.

### Model provider integrations generically

Create provider-facing types such as `IntegrationProvider`, `IntegrationConnectionStatus`, and `ProviderConnection`. GitHub-specific fields should be nested under the GitHub provider implementation rather than spread through settings or PR UI.

This avoids a second migration when GitLab, Bitbucket, or enterprise Git providers are added.

### Use backend-owned credentials and frontend-visible connection summaries

GitHub connection should use OAuth device authorization. Gitano should show the GitHub verification URL and user code, poll GitHub for completion, verify the resulting access token, and only then mark the provider connected. The GitHub OAuth client id should come from app configuration, local development environment configuration such as `.env.local`, or build configuration rather than user-entered secrets.

The frontend should never store provider tokens. Backend commands should expose only connection summaries such as provider id, connected account login, avatar URL, scopes/permissions summary, and last verification error.

Credential storage should use secure OS-backed storage where available. If secure storage is unavailable, Gitano should fail connection setup with a clear error instead of storing tokens in plaintext app state.

### Prefer native GitHub API integration over `gh` CLI dependency

Gitano should call GitHub APIs through backend HTTP commands using the configured integration token. The `gh` CLI is useful for development and manual debugging, but a core in-app PR workflow should not require an external CLI to be installed or authenticated.

### Fetch PR refs for local diff reuse

When opening a PR review, the backend should prepare local refs that represent the PR base and head without changing the user's checked-out branch. The branch comparison modal can then compare those refs using the existing diff pipeline.

This keeps diff rendering, AI review input, and inline comment anchoring consistent with existing branch comparison behavior.

### Keep pending PR count refresh separate from full PR list loading

The toolbar count should use a lightweight count endpoint/command and a cache keyed by repository identity. It should refresh when the active repository tab changes, on a fixed interval while the repository is active, and after review submission actions complete.

The full modal list should load richer PR data only when opened or manually refreshed.

### Submit review comments through GitHub review events

GitHub review submission should map actions to GitHub-native review events:

- `Approve` -> `APPROVE`
- `Request changes` -> `REQUEST_CHANGES`
- comment-only review submission -> `COMMENT`

Inline draft comments should be translated from Gitano review anchors into GitHub review comment payloads. Invalid or stale anchors should be rejected before submission with actionable feedback.

## Risks / Trade-offs

- GitHub line anchoring is strict and can reject stale or invalid positions -> validate local anchors against the prepared PR diff before submission and keep GitHub error details available in the action log.
- Periodic count refresh can create noise or rate-limit pressure -> use a lightweight count command, cache by repository, pause when the window/repository is inactive where possible, and back off after rate-limit or auth failures.
- Provider connection can fail for private repos or missing permissions -> surface connection status in settings and PR actions, and route users to Integrations instead of showing ambiguous PR errors.
- Forked PR refs can be harder to prepare than same-repo branches -> prefer GitHub PR refs when available and fall back to fetching the head repository ref using metadata from the PR payload.
- Secure credential storage differs by OS -> keep credential access behind a backend provider credential abstraction and test error handling for unavailable storage.
- A large PR modal can become noisy -> use a dense virtualized list/table pattern and load detailed comments only for the selected/opened PR.
