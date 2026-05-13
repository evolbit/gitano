## 1. Backend Realtime Watch Infrastructure (Rust)

- [x] 1.1 Add a repository watch manager in `src-tauri/src/git/` that can register/unregister watchers per `repoPath` and emit `gitano:repo-changed` payloads.
- [x] 1.2 Implement debounced snapshot reconciliation for `head`, `branches`, `tags`, `stashes`, `index`, and `working-tree` change kinds.
- [x] 1.3 Ensure watch coverage includes `.git` ref/index paths and worktree changes required for tracked/untracked file detection.
- [x] 1.4 Apply `$rust-best-practices` while implementing watcher lifecycle, snapshot typing, and error handling (ownership, `Result` propagation, minimal cloning).

## 2. Frontend Event Router and Hook (React)

- [x] 2.1 Add a centralized realtime subscription hook (for example `useRepoRealtimeEvents`) that listens once to backend repo-change events and filters by `repoPath`.
- [x] 2.2 Route incoming `kinds[]` to targeted refresh triggers for commits, working changes, stashes, and toolbar branch/tag data.
- [x] 2.3 Add a short dedupe/coalescing window per `repoPath+kind` to prevent burst-triggered redundant refresh cycles.
- [x] 2.4 Apply `$vercel-react-best-practices` to keep subscriptions stable, avoid unnecessary rerenders, and keep routing side effects isolated.

## 3. Surface Integrations and Polling Removal

- [x] 3.1 Remove periodic commit-list interval polling and migrate commit history freshness to realtime event-driven refresh.
- [x] 3.2 Update working changes, stash pane, and toolbar branch/tag refresh paths to consume centralized event routing without adding per-component transport listeners.
- [x] 3.3 Preserve immediate post-action refresh behavior (commit/push/stash) while converging action paths onto the same event contract.

## 4. Validation and Regression Checks

- [x] 4.1 Validate external Git operations (commit, checkout, stash create/pop/drop, branch/tag create/delete) trigger correct `kinds[]` and refresh the correct UI surfaces.
- [x] 4.2 Verify unchanged snapshot cases remain visually stable (no commit files flicker, no current-changes list jump) under event bursts.
- [x] 4.3 Verify watcher teardown and re-subscription behavior across repo tab switches, tab close/reopen, and app restart.
