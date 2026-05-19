## Context

The current changes commit bar already supports commit, push, menu options, and local AI commit message generation. The message area and action controls are visually split, while the AI button sits in the textarea wrapper without sharing the same loading affordance as other busy action buttons. The changes explorer row count area is shared across surfaces, so count padding must preserve narrow-pane truncation and existing row controls.

## Goals / Non-Goals

**Goals:**
- Make the commit message box visually contain its lower action bar.
- Keep editable message text constrained so it stops before the commit and dropdown buttons begin.
- Align commit changes insertion/deletion numbers with the right-side panel controls.
- Show a spinner/loading treatment on the AI commit message button while generation is running.
- Prevent soft-wrapped diff rows from creating visual gaps in the line-number gutter.

**Non-Goals:**
- Change commit, push, stash, or AI generation behavior.
- Redesign the full current changes pane.
- Change shared changes explorer tree semantics.
- Add a user-configurable diff wrapping preference.

## Decisions

### Decision: Treat the commit box as a single framed control

Use one bordered container for the message field plus its internal footer/action bar. The message editor should be borderless inside that frame and reserve bottom/right space so text does not collide with controls.

### Decision: Keep commit controls aligned to the bottom bar

Place the push checkbox on the left and commit/menu buttons on the right inside the commit box footer. The editable message area should use layout constraints so it ends before the right action group.

### Decision: Use existing loading affordance

Render the same spinner treatment used by busy toolbar actions inside the AI button when commit message generation is running. Preserve disabled behavior and screen-reader labels.

### Decision: Scope count padding to the commit changes layout where possible

Prefer a row prop, contextual class, or similarly scoped styling rather than globally shifting every explorer usage. If shared row classes are updated, preserve fixed count widths, truncation, status icons, and optional checkboxes.

### Decision: Keep diff code rows on one visual row by default

Use non-wrapping whitespace for rendered diff code cells in unified, split, and context rows. The diff viewer already scrolls, and keeping each source line to one visual row avoids perceived gaps in the line-number gutter.

## Risks / Trade-offs

- Shared explorer row regression: padding counts globally could disturb other surfaces. Scope the change where possible and verify affected surfaces.
- Text collision: moving controls into the framed commit box can overlap text on narrow widths. Reserve layout space and test narrow panes.
- Loading inconsistency: recreating spinner styles can drift. Reuse the existing spinner class or pattern.
- Long diff line overflow: disabling soft wrap requires horizontal scrolling for very long lines. Preserve the existing scrollable diff container.
