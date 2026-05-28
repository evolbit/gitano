## Context

Gitano currently uses a backend-owned OAuth token for GitHub API calls. This works for personal repositories and organizations that allow the OAuth app, but can fail with organization policy errors even when the same user can access the repository through `gh`.

The GitHub CLI can perform high-level PR actions and can also proxy exact REST and GraphQL requests through `gh api`. That means it can support the existing Gitano PR workflow if Gitano treats `gh` as a structured access backend rather than as informal shell scripting.

## Decisions

### Add explicit GitHub access methods

Settings should expose a GitHub access method selector:

- `OAuth`: use Gitano's stored OAuth token only.
- `GitHub CLI`: use the user's external `gh` installation only.
- `Automatic fallback`: prefer OAuth when connected, then retry through `gh` for known OAuth access-policy failures.

The default can be automatic fallback for users with OAuth configured, but users must be able to choose GitHub CLI only and avoid OAuth entirely.

### Treat `gh` as an external dependency

Gitano must not install `gh`. It should detect and report:

- `notInstalled`: `gh --version` cannot be executed.
- `notAuthenticated`: `gh auth status -h github.com` fails.
- `ready`: `gh api user` succeeds and returns account identity.

The settings UI should make this visible before the user selects GitHub CLI as the access method.

### Keep a typed GitHub PR service boundary

The frontend should continue calling typed Gitano commands. The backend should route those commands through a GitHub PR service abstraction:

```text
GitHubPrClient
  +-- OAuthGitHubClient
  +-- GhCliGitHubClient
```

The PR workflow should not know whether data came from OAuth or `gh`.

### Keep the PR workflow provider-neutral at the app boundary

GitHub is the only implemented pull request provider in this change, but the
Tauri command and frontend adapter boundary should not require pull request
screens to call GitHub-specific functions directly. Pull request workflows
should pass a provider id, currently `github`, through provider-neutral API
methods:

```text
provider_list_pull_requests(providerId, repoPath)
provider_submit_pull_request_review(providerId, repoPath, number, ...)
provider_merge_pull_request(providerId, repoPath, number, ...)
```

GitHub-specific OAuth and `gh` behavior remains behind the GitHub provider
router. Future GitLab or Bitbucket implementations can add provider-specific
remote resolution and operation mapping behind the same provider command shape
instead of adding another set of feature-level UI calls.

### Use structured process execution for `gh`

The `gh` client must execute a fixed program with explicit argument arrays and optional stdin JSON. It must not build shell command strings.

```text
GhCommand
  program: gh
  args: [...]
  cwd: repository path
  stdin: optional JSON/body text
  output: JSON
```

This mirrors the discipline used for ACP-style external integrations: explicit capabilities, typed request/response mapping, and bounded process execution.

### Prefer `gh api` for exact feature parity

High-level commands are useful but do not cover all Gitano review behavior. The `gh` backend should use:

- `gh pr list --json ...` where it returns enough data.
- `gh pr view --json ...` for PR detail.
- `gh pr review` for simple approve/request-changes/comment reviews when no inline comments are needed.
- `gh api` REST endpoints for inline review comments, file-level comments, replies, and edits.
- `gh api graphql` for review thread resolution state and resolve/reopen mutations.
- `gh pr merge` for future merge behavior.

### Automatic fallback is narrow

Automatic fallback should retry through `gh` for errors that plausibly indicate OAuth app access policy problems, such as GitHub's “resource not accessible by integration” or organization approval errors. It should not hide malformed requests, validation errors, invalid anchors, or non-GitHub failures.

## Capability Mapping

| Gitano operation | `gh` support | Preferred `gh` mapping |
|---|---:|---|
| Verify account | Yes | `gh api user` |
| List PRs | Yes | `gh pr list --json ...` |
| Count PRs | Yes | list and count locally |
| Prepare refs | Partial | continue using `git fetch`; `gh` not required |
| Conversation comments | Yes | `gh pr view --comments --json comments` or REST through `gh api` |
| Inline review comments | Yes | `gh api repos/{owner}/{repo}/pulls/{number}/comments` |
| Review thread metadata | Yes | `gh api graphql` |
| Submit approve/request changes | Yes | `gh pr review` or REST through `gh api` |
| Submit inline review comments | Yes | REST through `gh api` |
| File-level comments | Yes | REST through `gh api` |
| Review replies | Yes | REST through `gh api` |
| Edit comments | Yes | REST PATCH through `gh api` |
| Resolve/reopen threads | Yes | `gh api graphql` |
| Merge PRs | Yes | `gh pr merge` |

## Risks

- `gh` output fields and behavior may vary by installed version. Gitano should enforce a minimum supported version or fail with a clear message.
- `gh auth status` can be human-readable; account verification should use `gh api user` for structured identity.
- Automatic fallback can mask real bugs if too broad. Keep fallback predicates conservative and surface which access method was used.
- Enterprise hosts may need a later host-aware extension. This change can start with `github.com`.
