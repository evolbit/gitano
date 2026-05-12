## Why

The new commit box in the current changes pane supports commit actions, but its keyboard behavior, push feedback, and commit-history refresh behavior are not yet aligned with the existing top toolbar push workflow. This creates inconsistent UX and makes post-commit state updates feel unreliable.

## What Changes

- Add commit-box keyboard shortcuts: `Enter` commits, `Shift+Enter` commits and pushes.
- Reuse the same push feedback behavior used by the top toolbar push action, including success and error messaging.
- Scope top-toolbar push loading indication so it appears only when an explicit push operation is triggered.
- Refresh commit history immediately after commit/push from the commit box and keep periodic refresh active to detect newly added commits.

## Capabilities

### New Capabilities
- `commit-box-push-workflow`: Defines keyboard-triggered commit/push behavior and post-action history refresh expectations for the current changes commit box.

### Modified Capabilities
- `toolbar-remote-actions`: Ensure push loading and push result feedback behavior are shared across explicit push entry points, including commit-box initiated push actions.

## Impact

- Affected code: `src/components/current-changes-commit-bar/CurrentChangesCommitBar.tsx`, `src/components/top-toolbar/TopToolbar.tsx`, `src/hooks/useStageAndCommit.ts`, and `src/components/commit-list/CommitList.tsx`.
- Affected UX: commit box shortcuts, push feedback visibility, and commit list freshness after commit/push.
- No backend API changes are expected; orchestration is frontend/state behavior.
