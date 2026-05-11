## Context

`ChangesExplorer` is currently the most complex part of the current-changes surface. It combines live refresh orchestration, staging reconciliation, search and expansion state, context menu behavior, row rendering, and tree traversal in one large component file. The surrounding refresh hook also replaces the full file list on every poll, which creates visible scroll stutter when the repository has many changed files.

This change is a structural and performance refactor. The visible behavior of the explorer should remain the same: the same flat/tree modes, the same staging controls, the same modal behavior, and the same live working-changes semantics. The implementation should simply become easier to read and less disruptive during periodic refreshes.

## Goals / Non-Goals

**Goals:**
- Split `ChangesExplorer` into smaller modules with clear responsibilities.
- Move pure helpers out of the component so rendering and behavior are easier to scan.
- Keep the current explorer behavior and UI intact.
- Reduce scroll stutter by avoiding visible list replacement when the working-changes snapshot has not materially changed.
- Keep the live refresh behavior, but make it less expensive and less intrusive.

**Non-Goals:**
- Do not introduce virtualization in this change.
- Do not change the explorer’s visible behavior, actions, or layout.
- Do not redesign the working-changes data model.
- Do not change backend Git commands or staging semantics.

## Decisions

1. **Split the explorer by responsibility**
   - `ChangesExplorer.tsx` should become a thin coordinator that wires together state, helpers, and render sections.
   - Pure helper logic should move into utility modules.
   - JSX-heavy row rendering should be isolated from stateful orchestration.
   - Rationale: the current file mixes too many concerns, making both maintenance and performance tuning harder.
   - Alternative considered: keep the monolith and only extract a few helpers. Rejected because the refresh and render logic are already coupled and need clearer boundaries to stay understandable.

2. **Keep refresh orchestration separate from render code**
   - The polling hook should own snapshot fetching and comparison, while the explorer owns UI state and row rendering.
   - Rationale: the scroll stutter is driven by refresh invalidation, so the refresh path needs its own boundary.
   - Alternative considered: move refresh logic into the component. Rejected because it would make the main component even harder to reason about and would blur the line between data acquisition and presentation.

3. **Avoid publishing unchanged snapshots**
   - The refresh hook should compare the newly fetched working-changes snapshot with the previous snapshot and avoid updating state when nothing meaningful changed.
   - Rationale: the UI only needs a new render when the visible file set or file metadata has changed.
   - Alternative considered: continue replacing the list on every poll. Rejected because it causes periodic rerenders and scroll hitching even when the user is not interacting with the data.

4. **Keep staged-state reconciliation bounded**
   - Staged selection syncing should remain a separate reconciliation step and should only run when a refresh actually produces a new file snapshot.
   - Rationale: the staged-state rebuild is useful, but it should not run on every timer tick if the repository state did not change.
   - Alternative considered: merge staged reconciliation into the render path. Rejected because that would hurt responsiveness and mix expensive work into React rendering.

5. **Preserve object identity where possible**
   - When the snapshot changes, the refresh path should prefer reusing unchanged file entries instead of always forcing a brand-new shape for every file.
   - Rationale: stable identity reduces downstream rerenders even without virtualization.
   - Alternative considered: always replace the full array. Rejected because it guarantees broad invalidation in the explorer.

6. **Keep the explorer behavior unchanged**
   - Flat/tree view behavior, context menus, staged selection rules, folder expansion, and modal selection rebinding remain as-is.
   - Rationale: this refactor is about structure and responsiveness, not changing the product surface.
   - Alternative considered: use the refactor to simplify behaviors at the same time. Rejected because that would make regression analysis much harder.

## Risks / Trade-offs

- [Incremental comparison cost] → Snapshot comparison adds work to each refresh, but that cost is much smaller than re-rendering the full explorer on every unchanged poll.
- [Refactor breadth] → Breaking one large component into several modules can create short-term import churn; keep the split mechanical and preserve current behavior until the code is stable.
- [State duplication] → Some UI state will live in hooks while data helpers live in utilities; keep the split disciplined so logic does not get duplicated across files.
- [Missed invalidations] → If the refresh comparison is too aggressive, the UI could fail to update when it should; compare on stable file identity and relevant metadata, not only raw array length.

## Migration Plan

1. Extract pure helpers from `ChangesExplorer` into utilities and make the component depend on those helpers.
2. Move stateful orchestration into hooks so the main component only coordinates state and rendering.
3. Split row and menu rendering into dedicated modules to reduce the size of the main component file.
4. Update `useWorkingDirectoryChanges` so it compares snapshots before publishing state changes.
5. Verify that scroll remains responsive with many files and that staging/rebinding behavior still matches the current implementation.
6. If a regression appears, revert the new module boundary that introduced it without changing the explorer behavior itself.

## Open Questions

- Should the first pass prioritize a smaller `ChangesExplorer.tsx`, or the refresh comparison logic, if both are available at the same time?
- How far should snapshot comparison go: file path/status only, or also hunk metadata and insertion/deletion counts?
- Do we want the staged reconciliation to reuse unchanged file objects explicitly, or is avoiding redundant state publication sufficient for the first pass?
