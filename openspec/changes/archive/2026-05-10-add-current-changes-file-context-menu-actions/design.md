## Context

`ChangesExplorer` currently supports a pane-level context menu opened from the explorer container or header button. That menu is suitable for view-level actions like `Flat View` / `Tree View` and bulk actions like `Stage All`, but it is the wrong abstraction for acting on a specific file row.

What the user wants is a file-row context menu that:

- opens when a file row is right-clicked
- knows which file was targeted
- varies by tracked versus untracked status
- reuses the existing immediate staging model for `Stage File` / `Unstage File`

## Goals / Non-Goals

**Goals:**
- Add a file-specific context menu for current-changes rows in the diff modal.
- Show tracked and untracked menus with different action sets.
- Implement `Stage File`, `Discard Changes`, and `Trash File`.
- Keep the existing pane-level menu for explorer-wide actions.

**Non-Goals:**
- Replacing the pane-level menu entirely
- Implementing `Stash File`, `Show in Finder`, or `View File Blame` in this pass
- Adding file-row context menus to unrelated surfaces unless they already share the same explorer mode and requirements

## Decisions

### Separate pane menu from file-row menu
The explorer should distinguish:

```text
Pane menu -> layout / bulk actions
File menu -> actions for one specific file
```

This avoids overloading one menu with two different scopes.

### Track context-menu scope explicitly
The UI should track whether the open menu is for:

- the pane
- a file row

and if it is a file row, which file it belongs to.

### Reuse existing immediate staging logic for `Stage File`
`Stage File` / `Unstage File` should use the same per-file immediate staging path already used by the file checkbox logic. That keeps staging semantics consistent.

### Treat tracked and untracked destructive actions differently
Tracked files should use `Discard Changes`, because the operation means restoring Git-tracked content.

Untracked files should use `Trash File`, because the operation means removing a filesystem-only file rather than restoring tracked content.

### Include future menu items in disabled state
`Stash File`, `Show in Finder` / OS-specific label, and `View File Blame` may appear in the menu but should remain disabled until explicitly implemented.

## Menu Shapes

### Tracked file

```text
Stage File / Unstage File
Discard Changes
Stash File                (disabled)
Show in Finder            (disabled)
View File Blame           (disabled)
```

### Untracked file

```text
Stage File / Unstage File
Trash File
Stash File                (disabled)
Show in Finder            (disabled)
```

## Risks / Trade-offs

- [Pane and file menus may conflict] -> Keep explicit scope in menu state and ensure row right-click does not fall through to pane menu handling.
- [Tracked vs untracked classification must be reliable] -> Reuse the same tracked/untracked logic already used for grouping and checkbox behavior in `ChangesExplorer`.
- [Discard and trash are destructive] -> Make the labels explicit and keep implementation narrow to the requested actions first.
