## Why

Layout sizing for the main repo view is currently scattered between component literals and Tauri window config, which makes adjustments error-prone and hides the relationship between pane minimums and window minimum size. Centralizing these values will make the layout easier to maintain and ensure the app cannot be resized smaller than the main three-pane layout can support.

## What Changes

- Introduce centralized layout constants for the main repo view panes and window minimum dimensions.
- Define left, middle, and right pane sizing in one place, with numeric minimums and configurable initial sizes that may be numbers or percentages.
- Derive the minimum window width from the sum of the pane minimum widths so window constraints stay aligned with layout constraints.
- Update the main repo layout to consume the centralized pane sizing values instead of inline literals.
- Update window sizing initialization to use the centralized minimum dimensions.

## Capabilities

### New Capabilities
- `repo-layout-sizing`: Defines the main repo layout pane sizing model and the rule that window minimum width must be derived from the sum of pane minimum widths.

### Modified Capabilities

## Impact

- Affected frontend code includes `src/components/RepoTabLayout.tsx`.
- Affected window sizing configuration includes `src-tauri/tauri.conf.json` and likely startup/runtime window sizing code.
- A new shared constants module is expected in the frontend to hold layout and window sizing values.
