## Why

The shared notice state is currently named with `remote` terminology even though it now carries feedback for both remote operations (`pull`/`push`/`fetch`) and non-remote operations (`stash`/`pop`). This mismatch creates ambiguity in the codebase and makes future maintenance harder.

## What Changes

- Rename shared notice/status naming from `remote`-oriented terms to `git action`-oriented terms in the toolbar + commit flow state layer.
- Align feedback requirement language so the snackbar contract explicitly covers all supported git actions that use the shared feedback channel, not only remote operations.
- Preserve existing user-facing behavior (same snackbar location, success/error semantics, details expansion, and dismissal timing policy).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `toolbar-remote-actions`: Expand feedback terminology and requirement scope from remote-only language to shared git-action feedback semantics.

## Impact

- Affected code:
  - `src/store/remoteActions.ts` (store naming and API surface)
  - `src/components/top-toolbar/TopToolbar.tsx` (state selectors/setters and helper naming)
  - `src/components/current-changes-commit-bar/CurrentChangesCommitBar.tsx` (state setter naming)
  - Related type imports/usages for action notice/pending state
- No backend command/API contract changes.
- No behavior change expected for end users.
