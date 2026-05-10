## Why

The workspace toolbar currently shows `Pull` and `Push` as visual placeholders, but they do not execute repository operations or provide user feedback. That leaves an important part of the Git workflow incomplete at the main toolbar level.

Users also need control over how pull behaves. Desktop Git clients commonly let the user choose a default pull/fetch strategy and remember it globally. This app should do the same.

When remote operations fail, the current experience is not defined at the toolbar level. Users need a small non-blocking error surface that can show a short message first and expand into full error details on demand.

## What Changes

- Make the toolbar `Pull` and `Push` actions functional.
- Add a pull-strategy dropdown for `Pull`.
- Persist the selected pull strategy globally across repositories.
- Make the whole toolbar action surface clickable, not only the icon.
- Add hover affordances and contextual text/tooltip behavior for toolbar remote actions.
- Show remote-operation feedback in a bottom snackbar:
  - success as a brief auto-dismissing confirmation
  - failure as an expandable error with full details

## Capabilities

### New Capabilities
- `toolbar-remote-actions`: Defines actionable `Pull` and `Push` toolbar behavior, pull strategy selection, and error feedback.

## Impact

- Affected code in `src/components/TopToolbar.tsx`, related persistence store code, and backend Git commands for fetch/pull.
- Introduces a shared error-feedback surface for toolbar Git operations.
