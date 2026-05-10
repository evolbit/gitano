## Context

The shared changes explorer now supports both `Flat View` and `Tree View`, and diff modals can render the same explorer model. The remaining inconsistency is state ownership: view mode is currently coupled too broadly, while the desired behavior is per-pane independence with modal inheritance from the caller pane.

## Goals / Non-Goals

**Goals:**
- Let the working-tree changes pane and its modal flow maintain one view-mode state.
- Let the commit changes pane and its modal flow maintain a separate view-mode state.
- Ensure a modal opens in the same mode as the pane that launched it.
- Preserve the shared explorer component and shared file-selection behavior.

**Non-Goals:**
- Introduce a global explorer mode preference across the app.
- Change staging controls or context-menu contents.
- Unify working-tree and commit panes into a single shared store if local component state is sufficient.

## Decisions

### Keep view mode scoped to the originating pane
The working-tree pane and commit changes pane represent different user tasks. Their view preferences should not fight each other. If the user prefers `Tree View` for working changes and `Flat View` for historical commit inspection, the app should preserve both choices.

### Modal inherits, not overrides
The modal should not invent a third independent preference. Instead:

```text
working changes pane -> working-tree modal
commit changes pane  -> commit diff modal
```

Each modal should open using the mode of the pane that launched it, and mode changes inside the modal should update that originating pane's state only.

### Keep the shared explorer component stateless about preference ownership
`ChangesExplorer` should continue to receive `viewMode` and `onViewModeChange` as props. The change should happen in the parent ownership model, not inside the explorer itself.

## Architecture Sketch

```text
RepoTabLayout
├─ current changes pane
│  ├─ mode: workingChangesViewMode
│  └─ working-tree modal uses same mode
└─ commit details pane
   └─ ChangesPanel
      ├─ mode: commitChangesViewMode
      └─ commit diff modal uses same mode
```

## Risks / Trade-offs

- **[Risk] Mode ownership becomes fragmented** → Mitigation: keep exactly two sources of truth, one per pane family.
- **[Risk] Modal updates the wrong pane's state** → Mitigation: pass explicit mode props from each caller rather than falling back to a shared default.
- **[Risk] Commit pane still diverges in behavior** → Mitigation: keep it on the same shared explorer component and only change state ownership.
