## Why

The app still relies on a generic default font stack rooted in `Inter, Avenir, Helvetica, Arial, sans-serif`, while code and hunk surfaces use an implicit monospace fallback. That makes the typography feel inconsistent and generic. The desired direction is a deliberate IBM Plex pairing:

- `IBM Plex Sans` for the application UI
- `IBM Plex Mono` for hunk/code presentation

Because this is a desktop app, the fonts should be bundled locally instead of fetched remotely at runtime.

## What Changes

- Make `IBM Plex Sans` the default font for the whole app UI.
- Make `IBM Plex Mono` the font used for hunk/code surfaces.
- Keep the mono font scoped to code-oriented surfaces rather than scattering ad hoc font overrides.
- Bundle the fonts locally so the desktop app does not depend on external font CDNs.

## Capabilities

### New Capabilities
- `app-typography`: The app uses a deliberate bundled IBM Plex font system, with sans for UI and mono for code/hunks.

### Modified Capabilities
- `edit-diff-selection-gutters`: Editable diff hunks should continue to render code content in the dedicated mono code font.
- `working-tree-diff-modal`: Diff presentation should keep code surfaces on the mono code font while the surrounding modal UI uses the app sans font.

## Impact

- Affected frontend areas:
  - [src/index.css](/Users/marco/repositories/gitano/src/index.css)
  - [src/App.css](/Users/marco/repositories/gitano/src/App.css)
  - [src/main.tsx](/Users/marco/repositories/gitano/src/main.tsx)
  - [src/components/DiffViewer.tsx](/Users/marco/repositories/gitano/src/components/DiffViewer.tsx)
  - [src/components/DiffHunk.tsx](/Users/marco/repositories/gitano/src/components/DiffHunk.tsx)
  - [tailwind.config.js](/Users/marco/repositories/gitano/tailwind.config.js)
- Likely requires adding bundled font assets or a font package dependency.
