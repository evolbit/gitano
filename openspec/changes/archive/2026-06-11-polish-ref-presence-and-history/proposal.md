## Why

Gitano currently splits or summarizes local/remote ref state in ways that hide important Git facts: branch divergence is not visible in the branch tree, tags use text chips instead of compact presence controls, remote ref changes can leave history stale, and commit/comment surfaces lose context for multi-line messages and review hunks. These are small workflow papercuts, but together they make Gitano feel less trustworthy when users compare it with terminal Git or hosted pull request views.

## What Changes

- Support multi-line commit message entry from the current changes commit box, preserving subject and body when creating or amending commits.
- Warn when the first commit-message line exceeds Gitano's configured subject-length recommendation, without blocking commits solely because of length.
- Keep the branches panel's exclusive local/remote mode controls while rendering unified branch rows with ahead/behind divergence counts.
- Expose an explicit force-delete branch action for local branch rows so users can intentionally run `git branch -D` when safe delete refuses an unmerged branch.
- Add local and remote filter toggles to the tags panel; at least one toggle MUST remain active, both can be active, and the selection persists independently from the branch panel.
- Replace tag state chips with separate local computer and remote cloud icon indicators that start muted while state is unknown/loading and resolve to the row text color when known.
- Refresh commit history and graph data when remote refs change, using the existing repository event model instead of periodic polling.
- Keep commit search backed by the prepared local repository history, including fetched remote refs, while restyling it to match other search controls and preserving match count/navigation controls.
- Render pull request conversation diff hunks with add/delete coloring consistent with Gitano's other diff views.

## Capabilities

### New Capabilities

- `branch-ref-presence`: Unified branch tree behavior for local/remote branch metadata, divergence indicators, and branch location filtering.

### Modified Capabilities

- `commit-box-push-workflow`: Change commit box message entry and submission semantics to support multi-line messages and subject-length warnings.
- `branches-panel-design-parity`: Preserve exclusive branch local/remote mode controls while adding compact branch divergence indicators.
- `tag-ref-actions`: Change tag state presentation and add local/remote filter controls for the unified tags panel.
- `repo-realtime-events`: Route remote-ref repository events to commit-history refresh in addition to ref-panel refresh.
- `large-repo-history-loading`: Confirm commit search remains backend-prepared local history search over local, remote, and tag refs, and update search-control styling expectations.
- `github-pr-review-workflow`: Colorize diff hunks shown inside pull request conversation review comments.
- `workspace-ui-persistence`: Persist tag local/remote filter selections and the branch panel's local/remote view selection separately per repository and per panel.

## Impact

- Backend Git ref APIs in `src-tauri/src/git/commits/refs.rs`, branch divergence logic in Rust, and shared Git API/types in `src/shared/api/git` and `src/shared/types/git.ts`.
- Current changes commit box and commit workflow in `src/features/working-changes`.
- Branches panel state, header, tree rows, context menus, and tests in `src/features/branches`.
- Tags panel state, toolbar, tree rows, tag status rendering, and tests in `src/features/tags`.
- Repository realtime routing in `src/app/hooks/use-repo-realtime-events.ts`.
- Commit history/search UI and tests in `src/features/history`.
- Pull request conversation rendering in `src/shared/components/pull-request-history`.
- Per-repository workspace UI store shape and persistence migrations/defaults in `src/features/repository-workspace`.
