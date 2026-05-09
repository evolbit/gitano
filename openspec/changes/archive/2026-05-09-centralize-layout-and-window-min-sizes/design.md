## Context

The main repo screen layout is currently defined with inline split-pane literals in `src/components/RepoTabLayout.tsx`, while the window dimensions live separately in `src-tauri/tauri.conf.json`. This makes it easy for pane minimums and window minimum size to drift apart. The target layout has three logical sections: a left pane with a minimum width of `300`, a middle pane with a minimum width of `500`, and a right pane with a minimum width of `300`, with the window minimum width derived from the sum of those minimums.

## Goals / Non-Goals

**Goals:**
- Centralize the main repo layout sizing values in a shared frontend constants module.
- Support configurable pane initial sizes as either numeric pixel values or percentage strings.
- Keep pane minimum widths numeric so the minimum window width can be derived deterministically.
- Ensure the app window minimum width stays aligned with the sum of the left, middle, and right pane minimum widths.
- Update `RepoTabLayout` to consume the centralized sizing values instead of inline literals.

**Non-Goals:**
- Redesigning the split-pane structure or replacing the current split-pane library.
- Applying the new sizing system to unrelated split layouts such as diff modals unless they explicitly opt in later.
- Making every window dimension dynamic or user-configurable in this change.

## Decisions

Create a dedicated frontend layout constants module, for example `src/constants/layout.ts`, as the source of truth for pane sizing. This keeps layout policy separate from component rendering and makes future tuning easier.

Represent pane sizing with separate `min` and `initial` values. `min` stays numeric so the system can derive a concrete minimum window width. `initial` may be either a number or a percentage string because the split-pane component already accepts both patterns in the codebase.

Model the three logical panes explicitly even though the current UI uses nested splits. The outer split controls the left pane against the combined center/right region, and the inner split controls the middle pane against the right pane. This preserves the existing component structure while still letting the layout constants describe the user-facing three-section model.

Derive `windowMinWidth` from the pane minimums in code rather than hardcoding `1100` independently. This keeps the relationship visible and prevents future drift when pane minimums change.

Set the effective minimum window size at runtime from the same constants source rather than relying solely on `tauri.conf.json`. Static JSON cannot compute derived values from shared frontend constants, so runtime application is the cleanest way to preserve a single source of truth. The JSON config can retain a base width and height, but the runtime minimum should be the authoritative constraint.

## Risks / Trade-offs

- [Runtime window sizing may briefly differ from static config during startup] -> Keep the base config reasonable and apply the runtime minimum size as early as possible in app startup.
- [Nested split layout may make the middle pane minimum harder to enforce mentally] -> Document the mapping between logical panes and nested splits in the constants or adjacent code comments.
- [Allowing percentage initials could invite ambiguous future layouts] -> Limit percentage support to `initial` values only and keep minimums numeric.
