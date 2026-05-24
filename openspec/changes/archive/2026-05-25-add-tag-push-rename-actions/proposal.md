## Why

Tags can currently be viewed and created locally, but there is no clear way to publish tags, rename tags, delete remote tags, or understand whether a tag exists locally, on origin, or both. This makes tag workflows incomplete and can leave users unable to manage origin-only tags after deleting their local copy.

## What Changes

- Add a toolbar push mode selector with `Push current branch` and `Push current branch with tags`.
- Persist the selected toolbar push mode and use it when the primary Push action is clicked.
- Extend the tags panel to show unified local and origin tag rows with compact status indicators.
- Add tag row actions for pushing a single tag to origin, renaming a local tag, deleting a local tag, and optionally deleting the tag from origin.
- Remove non-implemented tag context menu actions such as `Solo` and `Hide`.
- Block local tag renames when the new name already exists locally or is known to exist on origin; allow rename with warning when origin cannot be checked.
- Keep tag rename local-only; users publish renamed tags explicitly from the tag row push action or toolbar push-with-tags mode.
- Keep toolbar push-with-tags publish-only; it MUST NOT delete remote tags.
- Make toolbar `Fetch All` fetch tags as well as remotes, and add a separate fetch-and-prune option for stale branches and tags.
- Load tags local-first with TanStack Query: show local tags immediately, refresh origin tag state in the background, and let tag panel remount refetching depend on query staleness.

## Capabilities

### New Capabilities
- `tag-ref-actions`: Covers local/origin tag visibility, tag status presentation, and executable tag context menu actions for push, rename, and delete.

### Modified Capabilities
- `toolbar-remote-actions`: Add a persisted push mode selector and support pushing the active branch together with local tags.
- `toolbar-remote-actions`: Extend fetch defaults so fetch-all includes tags and add fetch-all-with-prune.

## Impact

- Frontend tag panel data model, row rendering, status chips, context menu actions, rename/delete dialogs, validation states, and feedback.
- Frontend toolbar push menu, persisted workspace UI preference, loading/feedback labels, and push API call shape.
- Shared TypeScript Git APIs for remote tag discovery, tag push, rename, and delete.
- Tauri Git commands for local/remote tag listing, local tag rename/delete, single-tag push, optional remote tag delete, fetch-with-tags, fetch-with-prune, and push-with-tags.
- Tests for toolbar push mode persistence, tag status normalization, tag context menu behavior, rename validation, and backend command argument construction.
