## Context

The current repository workspace uses a left-side accordion in `RepoTabLayout` to host `Changes`, `Branches`, and `Folders`. This creates unnecessary vertical chrome, couples navigation semantics to an expandable control that is no longer a good fit, and persists UI state as an array of open accordion sections. The underlying content bodies are already separated enough that the shell can be changed without redefining their inner behavior.

## Goals / Non-Goals

**Goals:**
- Replace the accordion shell with a single active left-pane content area and a bottom navigation bar.
- Preserve repository-scoped persistence so each repository restores the last active left-pane section.
- Reuse existing `ChangesExplorer` and `BranchList` implementations as content bodies instead of rewriting their core behavior.
- Keep the left pane responsive and visually aligned with the existing workspace layout.

**Non-Goals:**
- Redesign the internal behaviors of `ChangesExplorer` or `BranchList`.
- Add new backend data or folder-management functionality.
- Change right-side commit details or diff modal behavior.

## Decisions

### Use single active section state instead of accordion-open arrays
The persisted left-pane state will change from `leftAccordionOpen: string[]` to a single selected section key. This matches the new interaction model directly and removes state shapes that only make sense for a multi-open accordion.

Alternative considered:
- Keep an accordion-compatible array state and derive the active tab from it. Rejected because it preserves obsolete semantics and increases migration noise.

### Render a dedicated pane shell around existing section bodies
`RepoTabLayout` will own the section header, active body switch, and bottom navigation. `ChangesExplorer` and `BranchList` will continue rendering their own content with minimal shell adjustments only where spacing or framing conflicts with the new layout.

Alternative considered:
- Move the entire left pane into a new compound component before changing the layout. Rejected for now because it adds refactor scope without changing the user-visible contract.

### Persist active section per repository
The active left-pane section will live in the same repository-scoped workspace UI store as pane widths and explorer view modes. This keeps repository context consistent and matches existing persistence behavior.

Alternative considered:
- Use a single global active section across all repositories. Rejected because the rest of the workspace state is already repository-scoped and mixing scopes would be inconsistent.

### Keep bottom navigation compact and icon-led
The navigation bar should visually match the reference by anchoring compact actions to the bottom edge of the pane. The active section label should come from the pane header instead of depending on wide navigation labels.

Alternative considered:
- Use full-width labeled tabs at the bottom. Rejected because the left pane width is constrained and dense labels reduce clarity faster than a compact icon-led control.

## Risks / Trade-offs

- Persisted state migration could leave stale accordion data in storage -> Mitigation: treat missing new state as a default and ignore the legacy field during restore.
- `BranchList` spacing may feel oversized when moved out of an accordion panel -> Mitigation: keep shell responsibilities in `RepoTabLayout` and trim only redundant internal padding if needed.
- The new bottom navigation may reduce discoverability if icons are too abstract -> Mitigation: retain a contextual header and use established repository icons with hover titles.
- Folders remains a placeholder section -> Mitigation: keep the section selectable but visually consistent so the new shell does not block future folder implementation.
