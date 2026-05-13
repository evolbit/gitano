## Context

`BranchList` currently renders a custom header and custom tree row styles that do not match the shared visual scaffolding used by `ChangesExplorer` and other left-pane content. During exploration, three UX gaps were identified: missing shared top-bar structure (search + mode controls), tree color/style drift, and connector rails that clutter the hierarchy. In the same panel, branch discovery also needs a stronger default sort that surfaces strategic branches first.

## Goals / Non-Goals

**Goals:**
- Make the branches panel visually consistent with shared left-pane panel design patterns.
- Add a searchable top control row with local/remote mode icons.
- Remove vertical connector rails in the branch tree while preserving hierarchy readability via indentation and chevrons.
- Introduce deterministic branch ordering with explicit priority for develop/main/stage branch families.

**Non-Goals:**
- No backend branch-fetching changes.
- No redesign of branch context-menu actions.
- No cross-panel refactor of all tree renderers in this change.

## Decisions

1. Use the shared panel framing pattern in branches.
- Decision: adopt the same top strip treatment used by other left-pane sections (bordered top bar area with search + right-side segmented controls).
- Rationale: consistency improves learnability and reduces context switching between sections.
- Alternative considered: keep existing pills and add only search. Rejected because it preserves visual drift.

2. Keep branch hierarchy structure but simplify connector visuals.
- Decision: remove vertical `border-l` connector rails from nested branch groups and rely on indentation + chevron + folder icon affordances.
- Rationale: reduces visual noise and matches requested design direction.
- Alternative considered: retain connectors with lighter contrast. Rejected because request explicitly asks to remove them.

3. Define explicit branch priority families in tree ordering.
- Decision: apply a stable ordering function in branch tree shaping:
  - Priority 0: develop family aliases
  - Priority 1: main family aliases
  - Priority 2: stage family aliases
  - Priority 99: all others alphabetical
- Rationale: improves scanning and reduces time-to-target for primary long-lived branches.
- Alternative considered: pure alphabetical sorting. Rejected because it hides key branches in large trees.

## Risks / Trade-offs

- [Risk] Alias matching may misclassify uncommon branch naming conventions. -> Mitigation: keep alias lists explicit and easy to extend.
- [Risk] Visual parity tweaks can unintentionally change interaction hit areas. -> Mitigation: preserve existing click handlers and row structure while only adjusting styling/layout wrappers.
- [Trade-off] Removing connector rails may reduce perceived nesting for some users. -> Mitigation: maintain clear indentation and chevron state.

## Migration Plan

- No data migration required.
- Rollout is frontend-only and can ship as a single release.
- If needed, rollback by reverting branch panel style and ordering utility changes.

## Open Questions

- Should local/remote mode controls be icon-only or icon+label at all viewport widths?
- Should branch search match full branch path, leaf name, or both?
