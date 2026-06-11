## Why

The shared diff viewer currently renders code as plain React text, which preserves Gitano's staging and review interactions but does not provide editor-quality syntax coloring. Replacing the hunk code surface with Monaco-backed rendering should make diffs easier to read while preserving the existing Git workflow behavior users rely on.

## What Changes

- Render shared diff hunk code content with read-only Monaco editor surfaces using Gitano's existing Monaco theme.
- Keep Gitano's parsed `DiffHunk` data, `hunkIdx + lineIdx` identities, and backend diff contracts unchanged.
- Preserve unified and split display modes, staging gutters, drag-based line selection, hunk context expansion, row-level add/delete coloring, and exact inline changed-text highlights.
- Preserve existing file and line review/comment anchors and accessory rendering around the Monaco code surface.
- Fall back gracefully for unsupported languages or Monaco load failures without changing staging or review behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `diff-display-modes`: Shared diff display modes must render source content through Monaco while preserving existing mode, selection, context, and inline-highlight behavior.

## Impact

- Affected frontend code:
  - `src/features/diffs/components/diff-hunk/*`
  - `src/features/diffs/components/diff-viewer-base/*`
  - shared Monaco theme/language helpers under `src/shared/lib/monaco`
- Existing dependency reuse:
  - `monaco-editor`
  - `@monaco-editor/react`
- No backend, Tauri command, or Git staging API changes are expected.
