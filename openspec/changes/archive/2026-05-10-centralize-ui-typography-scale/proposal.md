## Why

The app now has the correct font families, but UI text sizing is still inconsistent because multiple sizing systems are mixed together:

- root `html` font size
- Tailwind text utilities like `text-xs`, `text-sm`, and `text-[15px]`
- Mantine `size` props
- scattered inline `fontSize` values

As a result, changing the global base size does not reliably scale the whole UI. The desired behavior is:

- the whole app UI follows a centralized 16px-based typography scale
- hunks/code keep their own independent diff font size
- future overrides remain possible, but only when explicitly requested

## What Changes

- Introduce centralized UI typography size tokens for the app UI.
- Make normal UI surfaces resolve to the shared UI scale instead of relying on scattered hardcoded text sizes.
- Keep the existing diff/hunk size token separate from the general UI scale.
- Establish a clear central place to change default UI sizing later.

## Capabilities

### New Capabilities
- `ui-typography-scale`: The application UI uses a centralized typography size scale independent from hunk/code sizing.

### Modified Capabilities
- `app-typography`: App typography should distinguish not only font family but also centralized UI sizing versus independent diff sizing.
- `edit-diff-selection-gutters`: Diff/hunk sizing should remain independent from the general app UI scale.

## Impact

- Affected frontend areas:
  - [src/index.css](/Users/marco/repositories/gitano/src/index.css)
  - [src/main.tsx](/Users/marco/repositories/gitano/src/main.tsx)
  - likely multiple UI components currently using hardcoded text sizing, including:
    - [src/components/TopToolbar.tsx](/Users/marco/repositories/gitano/src/components/TopToolbar.tsx)
    - [src/components/ChangesExplorer.tsx](/Users/marco/repositories/gitano/src/components/ChangesExplorer.tsx)
    - [src/components/CommitList.tsx](/Users/marco/repositories/gitano/src/components/CommitList.tsx)
    - [src/components/BranchList.tsx](/Users/marco/repositories/gitano/src/components/BranchList.tsx)
- No backend changes are required.
