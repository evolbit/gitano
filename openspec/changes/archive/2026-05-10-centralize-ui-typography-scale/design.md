## Context

The app now uses `IBM Plex Sans` for UI and `IBM Plex Mono` for code/hunks, but text sizing is still spread across Tailwind utility classes, Mantine size props, and hardcoded pixel values. That makes the UI scale inconsistent and prevents one clean place from controlling the overall app size.

## Goals / Non-Goals

**Goals:**
- Create a centralized UI typography size system for normal app UI.
- Keep hunk/code sizing on its separate diff font-size token.
- Make the default UI scale clearly resolve to a 16px-based system.
- Preserve the ability to override individual components later when explicitly desired.

**Non-Goals:**
- Redesign the app’s full typography hierarchy beyond centralizing the current baseline sizes.
- Merge hunk/code sizing back into the main UI scale.
- Standardize every single text size in one pass if some low-value edge cases can remain for a later cleanup.

## Decisions

### Introduce dedicated UI size tokens
The app should expose a small shared set of UI typography size tokens, for example:

- `--ui-font-size-xs`
- `--ui-font-size-sm`
- `--ui-font-size-md`
- `--ui-font-size-lg`

These should define the default UI scale and make future global adjustments predictable.

### Keep diff sizing separate
The existing `--diff-font-size` token should remain independent. General UI token changes must not implicitly rescale hunks.

### Migrate important UI surfaces first
The change should focus on the major user-facing workspace surfaces and shared controls that currently rely on scattered explicit sizes. It does not need to eliminate every hardcoded size in one sweep if some low-impact leftovers remain outside the main workflow.

## Architecture Sketch

```text
Typography
├─ UI scale
│  ├─ --ui-font-size-xs
│  ├─ --ui-font-size-sm
│  ├─ --ui-font-size-md
│  └─ --ui-font-size-lg
└─ Diff scale
   └─ --diff-font-size

Normal UI
  -> uses UI scale tokens

Diff/Hunks
  -> uses diff scale token
```

## Risks / Trade-offs

- **[Risk] Mantine and Tailwind sizes drift again** -> Mitigation: centralize token definitions and map the most important UI surfaces to them explicitly.
- **[Risk] Some hardcoded text sizes remain** -> Mitigation: treat this as a focused main-workflow cleanup, not a promise to normalize every single component in the repo.
- **[Risk] UI feels too large or too small after centralization** -> Mitigation: keep the token layer compact so the baseline can be tuned in one place.
