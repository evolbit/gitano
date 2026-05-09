## Context

The current implementation uses `DiffFileList` as a flat file list in both the main workspace changes pane and the working-tree diff modal. That makes the two surfaces visually similar, but it cannot represent nested directories, tracked versus untracked grouping, or view-specific context menus cleanly. The modal also already has editable staging controls that should remain exclusive to that surface, while the main workspace should stay lighter and view-only.

## Goals / Non-Goals

**Goals:**
- Introduce one shared changes explorer model that supports `flat` and `tree` view modes.
- Reuse the same explorer structure in the main workspace changes pane and the working-tree diff modal.
- Group files into tracked and untracked sections in both view modes.
- Support surface-specific capabilities:
  - main workspace: no file checkboxes, context menu with only view switching
  - working-tree modal: file checkboxes, fuller context menu, but only view switching implemented initially
- Keep the selected file path stable when switching between flat and tree presentations.

**Non-Goals:**
- Implement staging functionality for the new modal context menu items beyond the existing checkbox-based staging behavior.
- Add folder-level staging semantics.
- Change backend diff, staging, or Git command behavior.

## Decisions

### Use a dedicated shared changes explorer instead of extending `DiffFileList`
`DiffFileList` is a flat list abstraction and would become overly complex if it had to support tracked/untracked grouping, folders, tree expansion state, and multiple context menu policies. A new shared explorer component should own:
- tracked/untracked grouping
- flat and tree render modes
- file selection rendering
- optional file checkboxes
- context menu policy per surface

`DiffFileList` can remain for simpler flat-list use cases such as committed file lists if needed.

### Keep view mode as shared explorer state, not separate implementations
The explorer should use the selected file path as its source of truth and render that same selection in either mode:

```text
selectedPath -> render flat row highlight
selectedPath -> render tree node highlight
```

This avoids selection loss when switching modes and makes the mode switch purely representational.

### Model tracked and untracked as top-level sections before flat/tree rendering
The explorer should first partition files into tracked and untracked groups, then render each group either as:
- flat rows with filename-first presentation
- a filesystem tree built from file paths

This keeps the grouping logic consistent across both modes and both surfaces.

### Use surface-specific context menu definitions
The right-click menu should be configurable by surface:
- main workspace changes pane: only `Flat View` and `Tree View`
- working-tree modal: full menu shape, but non-view actions disabled until implemented

This preserves consistency without forcing staging affordances into the main workspace.

## Risks / Trade-offs

- **[Risk] Tree and flat views diverge visually over time** → Mitigation: centralize row rendering and shared state in a single explorer component with capability flags.
- **[Risk] Search becomes inconsistent between views** → Mitigation: define one filtering model early, with tree mode expanding matching folders instead of changing to a separate flat-results mode.
- **[Risk] Context menu logic gets duplicated from `BranchList`** → Mitigation: mirror the existing pattern first, but keep the menu definition isolated so it can be extracted later if more panes need context menus.
- **[Risk] Selected row behavior becomes unstable when switching modes** → Mitigation: store selection by file path rather than by index or tree position.
