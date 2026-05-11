## Context

This change tightens visual consistency in existing workspace surfaces rather than introducing new product behavior. The toolbar already persists and restores the live left sidebar width, but the repository and branch selector region is still rendered from a separate fixed-width assumption. The shared changes explorer already supports flat and tree modes in both the working changes surface and the commit changes surface, but view switching remains hidden in the context menu and narrow tree rows do not reserve stable icon slots. The diff viewer already solved top alignment for split rows, but unified rows still use a vertically centered layout that diverges from split mode when rows become visually taller.

## Goals / Non-Goals

**Goals:**
- Drive the toolbar selector region from the same live width source as the left sidebar pane.
- Expose visible flat/tree toggle controls in both current changes and commit changes surfaces while preserving existing persisted mode state.
- Make unified diff rows use the same top-aligned number/content rhythm as split rows.
- Preserve fixed chevron and folder icon slots in narrow tree rows so commit file trees remain legible under compression.

**Non-Goals:**
- Rework the backend, diff data model, or tree-building logic.
- Introduce new view modes or remove the existing pane context menu switching path.
- Redesign file counters, badges, or selection behavior beyond the alignment and icon-slot fixes above.

## Decisions

### Use the sidebar width state as the only width source for toolbar selectors
The repository and branch selector region should consume the same persisted/live left pane width that already drives the workspace split layout. This avoids duplicate width bookkeeping and removes resize drift between the toolbar and the left sidebar.

Alternative considered:
- Measure the sidebar DOM independently from the toolbar. Rejected because it introduces a second timing-sensitive width path and increases the chance of resize lag.

### Add visible icon toggles without replacing persisted mode state
Flat/tree controls should become first-class visible toggles in the current changes panel and commit changes panel, but they should still update the existing persisted view-mode state for each surface. This improves discoverability without changing the underlying behavior contract.

Alternative considered:
- Keep context-menu-only switching and only improve labels. Rejected because the missing discoverability is the core UX problem.

### Align unified rows to split-row vertical rules
Unified rows should top-align their number cells and content cells using the same vertical inset strategy already used in split view. This keeps wrapped content and multiline rows visually consistent across both display modes.

Alternative considered:
- Adjust split rows to match unified centering. Rejected because split view already reads correctly and the inconsistency is isolated to unified rows.

### Reserve fixed icon slots in tree rows
Tree rows should reserve non-shrinking chevron and folder icon slots before the label. This makes narrow commit trees degrade by truncating labels first instead of collapsing the navigation affordances.

Alternative considered:
- Solve the narrow layout by enforcing a larger minimum width for the commit file pane. Rejected because it avoids the compression issue rather than making the tree resilient.

## Risks / Trade-offs

- [Toolbar width coupling could expose resize jitter] → Read directly from the existing sidebar width state instead of introducing new measurement logic.
- [Visible view toggles could crowd narrow headers] → Use compact icon toggles and keep them bound to the existing persisted state instead of adding more descriptive text.
- [Unified row alignment changes could subtly alter hunk density] → Reuse the split-view spacing rhythm so both modes stay visually consistent.
- [Fixed icon slots reduce label width in narrow trees] → Accept earlier label truncation because preserving the chevron/folder affordance is more important than squeezing a few more characters into the row.
