## 1. Backend Git Operations

- [x] 1.1 Add normalized local/origin tag ref data structures and command output types.
- [x] 1.2 Implement local tag ref discovery with direct object ids and annotated tag metadata needed for rename.
- [x] 1.3 Implement origin tag discovery with `git ls-remote --tags origin`, normalizing peeled `^{}` refs into the owning tag row.
- [x] 1.4 Implement a command to return merged tag rows with `local-origin`, `local`, `origin`, `conflict`, or `unknown` status.
- [x] 1.5 Extend toolbar push backend behavior to support branch-only and branch-and-tags modes without pruning remote tags.
- [x] 1.6 Implement single-tag push to `origin` without requiring the current branch to exist remotely.
- [x] 1.7 Implement local tag rename with local duplicate validation, annotated-tag recreation, and no automatic push.
- [x] 1.8 Implement local tag deletion and explicit origin tag deletion, deleting from origin before local deletion when both are requested.
- [x] 1.9 Add backend tests for tag ref normalization, push mode command construction, rename validation, and delete ordering.
- [x] 1.10 Split local and origin tag ref commands so the frontend can render local tags before origin lookup completes.
- [x] 1.11 Extend fetch backend behavior so `Fetch All` includes tags and a separate prune mode prunes stale branches and tags.

## 2. Shared Frontend APIs

- [x] 2.1 Add typed shared Git API functions for merged tag refs, single-tag push, rename tag, delete tag, and origin-name validation.
- [x] 2.2 Update push API types to pass the selected push mode to the backend.
- [x] 2.3 Add frontend utilities or type guards for tag status and allowed row actions.
- [x] 2.4 Add typed shared Git API functions for separate local/origin tag refs and fetch modes.

## 3. Toolbar Push Mode

- [x] 3.1 Add a persisted push mode to the workspace UI store with a default of branch-only.
- [x] 3.2 Add a Push dropdown mirroring the existing Pull dropdown pattern.
- [x] 3.3 Route the primary Push action through the selected push mode.
- [x] 3.4 Update push loading, tooltip, success, and failure copy for branch-only and branch-and-tags outcomes.
- [x] 3.5 Add toolbar tests for default mode, persisted mode selection, and push-with-tags API calls.

## 4. Tags Panel Data and Rendering

- [x] 4.1 Replace local-only tag loading with merged local/origin tag ref loading.
- [x] 4.2 Render compact right-aligned status chips for `Local · Origin`, `Local`, `Origin`, `Conflict`, and `Unknown`.
- [x] 4.3 Keep tree grouping and search behavior working with merged tag rows.
- [x] 4.4 Ensure origin-only tags remain visible after local-only deletion.
- [x] 4.5 Add tags panel tests for merged states, conflict state, origin unavailable state, grouping, and search.
- [x] 4.6 Use TanStack Query for local/origin tag ref caching, stale-time based remount behavior, and active refetch after explicit repo-ref events.
- [x] 4.7 Render local tags immediately while origin tags are still loading.

## 5. Tag Row Actions

- [x] 5.1 Replace the existing tag context menu with executable actions only and remove `Solo`, `Hide`, and other non-implemented placeholders.
- [x] 5.2 Add `Push tag to origin` for local-only tags and disable or omit it for already-published, origin-only, and conflicting tags.
- [x] 5.3 Add a local rename dialog with debounced origin-name validation, local duplicate validation, unavailable-origin warning, and local-only confirmation.
- [x] 5.4 Add a delete dialog that shows `Delete from origin too` only when the tag is known to exist on origin.
- [x] 5.5 Add origin-only delete behavior for tags that exist only on `origin`.
- [x] 5.6 Refresh tag state and show success/failure feedback after push, rename, and delete actions.
- [x] 5.7 Add interaction tests for context menu options, rename validation states, local-only rename, delete checkbox visibility, and origin-only delete.

## 6. Verification

- [x] 6.1 Run Rust formatting and backend tests.
- [x] 6.2 Run frontend lint/build and focused component tests.
- [x] 6.3 Manually verify toolbar push mode, tag push, local rename, local delete, delete-from-origin, and origin-only tag visibility in a test repository.
- [x] 6.4 Run `openspec validate --all` after implementation.
