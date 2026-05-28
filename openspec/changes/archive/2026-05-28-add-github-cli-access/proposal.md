## Summary

Add GitHub CLI (`gh`) as an explicit GitHub integration access method that users can select in settings. Gitano will keep OAuth support, but users can choose `gh` only, OAuth only, or automatic fallback. The GitHub CLI path will be validated but never installed by Gitano.

## Motivation

GitHub OAuth access can be blocked for organization repositories when an organization has not approved the app or has stricter third-party access policy. Many users already have `gh` installed and authorized with the organization through GitHub's own CLI flow. Gitano should be able to use that existing authorization as a user-controlled fallback or as the primary access method.

## Scope

- Add GitHub access method settings for OAuth, GitHub CLI, and automatic fallback.
- Detect whether `gh` is installed.
- Detect whether `gh` is authenticated for `github.com`.
- Expose GitHub CLI account identity and version when available.
- Route GitHub PR operations through the selected access method.
- Use automatic fallback only when OAuth fails due to access restrictions that `gh` may bypass.
- Preserve the current OAuth flow for users who prefer app-managed credentials.

## Non-Goals

- Installing `gh` from Gitano.
- Replacing all GitHub REST/GraphQL request modeling with ad hoc shell commands.
- Adding GitLab or Bitbucket providers in this change.
- Adding merge UI in this change, though the design should support a future merge action.

## User Impact

Users who cannot use Gitano OAuth for organization repositories can select GitHub CLI in settings and continue using PR list, comments, reviews, and future merge operations through their existing `gh` authentication.
