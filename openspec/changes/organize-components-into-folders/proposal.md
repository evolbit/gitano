## Why

The component layer has grown into a set of large mixed-responsibility files. Some files now combine rendering, local types, pure helpers, and stateful hooks, which makes the code harder to scan and maintain. A folder-based organization will make the structure easier to navigate and will create clear places for shared utilities and component-local concerns.

## What Changes

- Introduce a folder-per-component layout for `src/components`, with the main component file stored inside its own directory.
- Separate component-local types into `types.ts` files when a component has non-trivial local shapes.
- Separate reusable component behavior into `hooks.ts` files when a component has meaningful local hook logic.
- Move pure reusable helpers into shared utility modules so they can be consumed across components.
- Preserve current runtime behavior and UI output.

## Capabilities

### New Capabilities
- `component-folder-organization`: component source files are organized into feature folders with clear separation between component rendering, local types, hooks, and shared utilities.

### Modified Capabilities
- None

## Impact

- Affected code: `src/components/*` and shared helper modules under `src/components/utils/`.
- No backend/API changes.
- No user-facing behavior changes are expected.
- Import paths will change across the component layer as files move into folders.
