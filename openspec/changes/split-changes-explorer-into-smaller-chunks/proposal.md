## Why

`ChangesExplorer` has grown into a large, difficult-to-read component that mixes state orchestration, row rendering, menu handling, and data shaping in one file. We need to split it into smaller modules to improve maintainability without regressing the explorer’s scroll performance or introducing new rerender churn.

## What Changes

- Split `ChangesExplorer` into smaller component-local modules for pure helpers, renderers, and state/effect orchestration.
- Keep component-specific utilities local to the component folder unless they are truly shared.
- Prefer hooks only for stateful or effect-driven logic; keep pure data transforms as plain utilities.
- Extract hot row and menu rendering into dedicated module(s) that can be memoized without changing behavior.
- Preserve current explorer behavior, including flat/tree view, staging, context menus, and modal rebinding.
- **BREAKING**: none for user-facing behavior; this is an internal organization refactor only.

## Capabilities

### New Capabilities
- `changes-explorer-component-structure`: organize the explorer into smaller modules while preserving behavior and render performance.

### Modified Capabilities
- None.

## Impact

Affected code includes the current changes explorer implementation, its local helper functions, and any supporting row/menu renderers or hooks extracted during the refactor. No API or product behavior changes are expected; the main risk is rerender regressions if the module split introduces unstable props or new subscriptions in hot paths.
