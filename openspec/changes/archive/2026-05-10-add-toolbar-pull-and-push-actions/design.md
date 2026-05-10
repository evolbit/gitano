## Context

`TopToolbar.tsx` already renders `Pull` and `Push` controls, but they are currently passive icon/text stacks rather than real actions. The toolbar also does not expose any persisted pull strategy or a defined remote-operation feedback surface.

There are three concerns that need to work together:

```text
Toolbar action surface
    -> what is clickable, hoverable, and selectable

Remote operation execution
    -> fetch / pull / push backend commands

User feedback
    -> success/failure messaging without blocking the workflow
```

## Goals / Non-Goals

**Goals:**
- Make toolbar `Pull` and `Push` actionable.
- Support persisted global pull strategy selection.
- Keep the primary toolbar hit area broad and obvious.
- Show compact error feedback with expandable details.

**Non-Goals:**
- Reworking stash, pop, or branch toolbar actions in this pass
- Designing a full notifications framework for the entire app
- Adding repository-specific pull strategy overrides

## Decisions

### Treat `Pull` as a split button
The `Pull` control should behave like:

```text
primary click  -> execute the selected default pull/fetch operation
secondary menu -> choose the default operation
```

This mirrors desktop Git clients and keeps the common path fast.

### Persist pull strategy globally, not per repo
The selected default pull/fetch strategy should be stored once for the app and reused across repositories.

That means this preference belongs in global persisted UI/app state rather than `repoPath`-scoped workspace state.

### Keep `Push` as a direct action with contextual hover text
`Push` does not need a strategy menu in this pass. The main hover affordance should explain the target, e.g.:

```text
Push to origin/main
```

### Use a bottom snackbar for remote-operation feedback
Failures should appear in a compact bottom snackbar:

```text
git pull failed   View Log
```

If expanded, the snackbar should reveal the full stderr/error body without forcing a modal workflow.

This keeps the toolbar responsive and avoids blocking the workspace.

Success should use the same surface more quietly:
- green success icon
- compact message
- auto-dismiss after a shorter timeout

Failures should remain stronger:
- error icon/color
- expandable details
- longer timeout

### Make the full action tile clickable
The label and icon should belong to one actionable tile.

```text
┌──────────────┐
│ Pull         │
│   ↓          │
└──────────────┘
```

not:

```text
label  (dead)
icon   (only clickable element)
```

### Hover should communicate intent
The remote toolbar actions should have a stronger hover affordance than the current passive icon stack. The hover state should make the tile feel actionable and should support concise contextual messaging.

## Pull Strategy Model

Recommended initial set:

```text
Fetch All
Pull (fast-forward if possible)
Pull (fast-forward only)
Pull (rebase)
```

Suggested internal values:

```ts
type PullStrategy =
  | "fetch-all"
  | "pull-ff-if-possible"
  | "pull-ff-only"
  | "pull-rebase";
```

## Error Feedback Model

```text
operation fails
    ->
show compact snackbar at bottom
    ->
user may expand details
    ->
full command error is visible
```

The compact message should be short and operation-specific:
- `git fetch failed`
- `git pull failed`
- `git push failed`

## Likely Integration Points

- `src/components/TopToolbar.tsx`
  - action surface
  - pull strategy dropdown
  - hover treatment
- persisted global UI/app store
  - pull strategy preference
- backend Git commands
  - fetch
  - pull with strategy
  - push
- shared snackbar/error state near workspace shell or toolbar owner

## Risks / Trade-offs

- [Toolbar becomes crowded] -> Keep `Push` simple and use a split-button only for `Pull`.
- [Feedback becomes noisy] -> Only show snackbar on failure in this pass.
- [Pull strategy persistence placed in the wrong store] -> Keep it global rather than repo-scoped.
- [Remote commands may fail for auth/upstream reasons] -> Preserve and expose full backend error details in the expandable snackbar.
