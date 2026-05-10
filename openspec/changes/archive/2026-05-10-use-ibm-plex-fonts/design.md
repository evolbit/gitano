## Context

The current app font is still defined in [src/App.css](/Users/marco/repositories/gitano/src/App.css) using a generic stack, while code surfaces rely on existing `font-mono` usage in [src/components/DiffViewer.tsx](/Users/marco/repositories/gitano/src/components/DiffViewer.tsx) and [src/components/DiffHunk.tsx](/Users/marco/repositories/gitano/src/components/DiffHunk.tsx). That means the typography split already exists conceptually, but it is not yet tied to a deliberate font system.

## Goals / Non-Goals

**Goals:**
- Apply `IBM Plex Sans` across the app UI.
- Apply `IBM Plex Mono` to hunk/code presentation.
- Keep the font setup centralized and consistent across Mantine and Tailwind usage.
- Bundle the fonts locally for reliable desktop rendering.

**Non-Goals:**
- Redesign typographic scale, spacing, or weights across the app.
- Create a full typography design system beyond font-family selection.
- Replace every explicit `font-mono` usage with custom per-component fonts if the existing mono token can be reused cleanly.

## Decisions

### Use a global sans font and a shared mono token
The app should have one default UI font family and one code font family:

- default UI font: `IBM Plex Sans`
- code font: `IBM Plex Mono`

This keeps the implementation simple and matches the current separation between general UI and diff/code surfaces.

### Reuse existing mono surfaces instead of inventing new per-component overrides
The diff viewer and hunk components already use `font-mono`. The cleanest implementation is to make the app’s mono token resolve to `IBM Plex Mono`, while the global/root font resolves to `IBM Plex Sans`.

### Bundle fonts locally
Since this is a Tauri desktop app, fonts should be packaged with the app rather than fetched from a remote service. That avoids runtime dependency on external font hosting and keeps rendering deterministic.

## Architecture Sketch

```text
Global UI
├─ body / root / Mantine theme -> IBM Plex Sans
└─ Tailwind default sans token -> IBM Plex Sans

Code surfaces
├─ Tailwind font-mono token -> IBM Plex Mono
└─ DiffViewer / DiffHunk / code-ish UI -> IBM Plex Mono
```

## Risks / Trade-offs

- **[Risk] Mantine and Tailwind resolve different default fonts** -> Mitigation: set the font family centrally rather than relying on only one styling layer.
- **[Risk] Existing `font-mono` uses beyond hunks also switch to IBM Plex Mono** -> Mitigation: accept that for code-like surfaces unless a later refinement explicitly narrows the mono scope.
- **[Risk] Local font asset choice adds packaging complexity** -> Mitigation: keep the font setup minimal and use a straightforward bundled asset or package-based import path.
