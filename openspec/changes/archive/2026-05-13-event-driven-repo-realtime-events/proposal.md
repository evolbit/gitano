## Why

The workspace still relies on periodic frontend polling for commit and working-change freshness, which causes avoidable UI churn and delayed updates. We need near real-time, backend-driven repository change signaling so the UI updates quickly without timer-based flicker.

## What Changes

- Add a backend repository observation layer that detects local repository state changes and emits debounced, typed Tauri events.
- Add a centralized frontend subscription hook that listens once, routes event kinds to targeted refresh actions, and deduplicates bursty updates.
- Replace periodic commit-list polling with event-driven refresh triggered by backend repo-change events.
- Keep action-driven immediate refreshes (commit/push/stash) while converging all refresh paths onto the same event contract.
- Add branch and tag change detection to the backend event payload so branch/tag-dependent UI can refresh near real-time.

## Capabilities

### New Capabilities
- `repo-realtime-events`: Detect repository changes in the backend and emit typed realtime events that the frontend consumes through a single subscription router.

### Modified Capabilities
- `changes-explorer-refresh-responsiveness`: Shift working-changes refresh semantics from periodic timer emphasis to backend event-driven refresh while preserving stable rendering guarantees.
- `commit-box-push-workflow`: Remove dependence on periodic commit-list refresh and require event-driven commit history updates after commit actions.
- `stash-workflow`: Require stash surfaces to react to emitted stash-change events, including external stash updates.
- `toolbar-remote-actions`: Require branch/tag-dependent toolbar data to refresh from repository change events rather than manual or timer-only refresh paths.

## Impact

- Frontend: `src/components/commit-list/CommitList.tsx`, `src/components/repo-tab-layout/RepoTabLayout.tsx`, `src/components/stashes-panel/StashesPanel.tsx`, `src/components/top-toolbar/TopToolbar.tsx`, new shared realtime hook(s), and event constants.
- Backend: `src-tauri/src/main.rs` plus new repository watch/signature module(s) under `src-tauri/src/git/`.
- Runtime behavior: reduced periodic polling pressure, faster UI sync for commits/branches/tags/stashes/working tree.
