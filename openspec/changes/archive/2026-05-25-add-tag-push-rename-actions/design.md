## Context

The toolbar currently exposes executable Pull and Push actions, but Push always runs the default branch push. The tags panel currently lists local tags, can create local tags, and has a context menu with mostly disabled placeholder actions. Because the panel does not represent origin-only tags, deleting a local tag without deleting it from origin makes the remote tag disappear from the obvious management surface.

This change introduces two related workflows:

- Publishing tags explicitly from either the toolbar or a tag row.
- Managing tags as local/origin refs with clear status and safe rename/delete behavior.

## Goals / Non-Goals

**Goals:**
- Let users choose whether the toolbar Push action pushes only the active branch or the active branch plus local tags.
- Let users push an individual local tag to origin from the tag row context menu.
- Show tags as a unified local/origin list with status chips so origin-only tags remain manageable.
- Support local-only tag rename with local and origin-name conflict validation.
- Support local tag deletion with an optional origin deletion checkbox only when the tag is known to exist on origin.
- Remove non-implemented tag context menu actions so the menu contains only usable actions.

**Non-Goals:**
- No automatic remote deletion from toolbar push-with-tags.
- No force-push/update of conflicting remote tags.
- No automatic remote rename; renamed tags are published later through explicit push actions.
- No branch-list redesign.
- No tag checkout, tag filtering solo/hide, branch-from-tag, cherry-pick-from-tag, or annotation editing.

## Decisions

### Use a unified tag list instead of Local/Remote tabs

Tags do not have upstream/tracking relationships like branches. A tag name is the user-facing identity, and local/origin state is best presented as metadata on the same row.

The tags panel will merge local tags and origin tags into one tree/list model:

```text
v1.0.0   Local · Origin
v1.1.0   Local
v1.2.0   Origin
v1.3.0   Conflict
```

Rows may still be filtered later by status, but the default view should be all tags. This keeps origin-only tags visible after local deletion.

Alternative considered: Local/Remote tabs like branches. Rejected for this change because it hides the main conflict/deletion problem and implies branch-like tracking semantics that tags do not have.

### Normalize tag refs in the backend

The backend should produce normalized local and origin tag-ref models that can be loaded independently and merged for display. The legacy merged command can remain available for compatibility, but the panel should use separate local/origin queries so local tags can render before network-backed origin lookup completes.

The normalized tag-ref model includes:

- tag name
- local ref object id, when present
- origin ref object id, when present
- optional peeled target ids for display or future diagnostics
- status: `local-origin`, `local`, `origin`, `conflict`, or `unknown`

Remote tags should be discovered with `git ls-remote --tags origin` and normalized to ignore annotated-tag peeled `^{}` duplicates as duplicate rows. Equality should compare the direct tag ref object id, not only the peeled commit id, because annotated tags can point at the same commit while having different tag objects.

Alternative considered: compare only peeled targets. Rejected because it would hide annotated tag object conflicts that Git push would still reject.

### Load tag refs local-first with TanStack Query

The tags panel should use TanStack Query for tag ref loading:

- local tags query: local Git database only, fast path for initial rendering
- origin tags query: `git ls-remote --tags origin`, network-backed and independently stale-timed
- derived merge: combines local and origin data into `Local · Origin`, `Local`, `Origin`, `Conflict`, or `Unknown`

Origin query `staleTime` is 60 seconds. Opening the tags panel again within that window should reuse query data instead of refetching only because the panel remounted. Explicit Git actions such as fetch, push, rename, delete, and repo-ref refresh events should invalidate/refetch the active tag queries.

When the local query succeeds before the origin query, local tags must be visible immediately. Until origin data is available, local tags whose remote state is unknown should render as `Unknown`; once origin resolves, the rows update to their final local/origin status.

### Keep toolbar push-with-tags publish-only

Toolbar push mode will be persisted as:

```text
push-branch
push-branch-and-tags
```

`push-branch-and-tags` should push the active branch, then push local tags. It must not delete tags from origin. The tag push step should include lightweight tags, because Gitano creates lightweight tags by default when the user does not choose an annotated tag.

Alternative considered: `git push --follow-tags`. Rejected for the default push-with-tags mode because it skips lightweight tags, which would make Gitano-created tags fail to publish unless they were annotated.

### Fetch-all includes tags, prune is explicit

Toolbar fetch behavior should become:

```text
fetch-all        -> git fetch --all --tags
fetch-all-prune  -> git fetch --all --tags --prune --prune-tags
```

This gives users an explicit way to download remote tags into local refs and a separate explicit way to prune stale local branches/tags. The prune option is separate because deleting local tag refs as a side effect of normal fetch is surprising.

### Keep tag rename local-only

Rename creates a new local tag name at the old tag target and deletes the old local tag. It never pushes automatically.

Rename validation:

- new name must be syntactically valid
- new name must not exist locally
- new name must not be known to exist on origin
- if origin cannot be checked, rename is allowed with a warning that later push may fail

For annotated tags, rename should recreate an annotated tag object using the new tag name while preserving the target and message where possible. The resulting tag object can have a new id; that is expected. For lightweight tags, rename should create a lightweight tag at the same target.

Alternative considered: point the new tag ref at the existing annotated tag object. Rejected because the embedded annotated tag name would remain the old name.

### Make remote deletion explicit and contextual

Delete behavior depends on tag status:

- `local`: delete local tag only.
- `local-origin`: show a delete dialog with an unchecked `Delete from origin too` checkbox.
- `origin`: offer delete-from-origin directly because there is no local tag to remove.
- `conflict`: allow copy/link actions and local delete; remote update/delete actions must remain explicit and should not force-update the tag.

When deleting both local and origin, delete from origin first, then delete locally. If remote deletion fails, the local tag remains available and the user sees a clear error.

Alternative considered: let toolbar push-with-tags prune origin tags that no longer exist locally. Rejected because remote deletion is destructive and should only happen from an explicit delete flow.

### Keep frontend simple and delegate Git decisions to backend

The frontend should request normalized tag data and trigger named operations. It should not parse Git command output or infer annotated-tag object identity. It can own presentation state, debounced rename validation UI, and dialog flows.

## Risks / Trade-offs

- [Risk] `git push --tags` can push unrelated local tags, not only tags related to the current branch. → Mitigation: label the option as pushing the branch and local tags; keep the default as branch-only.
- [Risk] Remote tag listing can fail offline or when origin is not configured. → Mitigation: keep local tags visible, mark remote state as unknown when needed, and allow local-only rename with a warning.
- [Risk] Query cache could show fresh-but-not-current remote tag state for up to the stale time. → Mitigation: explicit fetch/push/tag mutations force tag query refresh, while passive panel remounts avoid unnecessary network calls.
- [Risk] Same tag name may point to different local and origin objects. → Mitigation: surface a `Conflict` status and avoid force-push behavior in this change.
- [Risk] Rename of annotated tags changes the tag object id. → Mitigation: document this in design and test that target/message are preserved where possible.
- [Risk] Remote delete can partially fail. → Mitigation: perform remote deletion before local deletion when both are requested.

## Migration Plan

No data migration is required. The persisted workspace UI store can add the push mode with a default of `push-branch` for existing users and accept the new `fetch-all-prune` pull/fetch strategy only when the user selects it.

Rollback is straightforward: ignore the persisted push mode value and keep plain Push behavior. Local/origin tag operations are direct Git ref operations and do not require application data cleanup.

## Open Questions

- Should the toolbar menu label say `Push branch + tags` or `Push branch and local tags`? The latter is clearer but longer.
- Should origin-only tags get a future `Fetch tag locally` action? It is useful but outside the current push/rename/delete scope.
