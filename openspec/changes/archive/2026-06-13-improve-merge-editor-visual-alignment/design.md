## Context

The current conflict resolution surface already uses lazy-loaded Monaco editors for normal-sized read-only side panes and the editable result panel. The result editor also uses Monaco view zones to add display-only alignment rows when the projected result is shorter than side content.

The read-only `Incoming` and `Current` panes currently render conflict actions as Monaco content widgets positioned above conflict ranges. Because those widgets do not reserve editor layout space, actions can visually overlap the source line they refer to. The surface also shares one raw `scrollTop` value across panes, which keeps pixel offsets synchronized but does not reliably align matching conflict regions when the two sides have different line counts.

## Goals / Non-Goals

**Goals:**

- Give `Incoming`, `Current`, and `Result` consistent, subtle visual identities.
- Ensure side-pane conflict action rows reserve non-numbered visual space and never cover code.
- Keep side panes visually aligned around matching conflict regions while scrolling, even when one side has extra or missing lines.
- Reuse the existing conflict region projection data and Monaco view-zone approach where possible.
- Keep visual padding display-only and isolated from saved result content.
- Cover normal Monaco panes with focused tests and preserve bounded behavior for range-loaded panes.

**Non-Goals:**

- Replacing the merge editor layout.
- Changing backend conflict APIs or conflict parsing.
- Adding semantic three-way merge behavior.
- Adding user-configurable colors or theme editing.
- Making very large range-loaded panes perfectly equivalent to full Monaco panes when the required alignment data is not loaded.

## Decisions

### Decision: Centralize side/result visual identity near the conflict feature

Define named visual metadata for `Incoming`, `Current`, and `Result` close to the merge-conflict feature. The metadata should include label color, border/accent color, conflict fill color, active fill color, overview ruler color, and action/widget accents where needed.

This keeps semantic colors out of individual components and avoids scattered raw string literals for conflict-side meaning. The colors should be subtle enough to preserve syntax readability in the Ayu Dark editor theme. A practical mapping is:

- `Incoming`: cyan/teal family
- `Current`: amber/yellow family
- `Result`: purple/magenta family

Alternative considered: Keep all conflict regions amber. That preserves the current UI but makes side identity rely mostly on text labels and does not satisfy the requested visual distinction.

### Decision: Use editor view zones for side-pane action rows

Side-pane actions should still be attached to the relevant conflict region, but each action row should reserve a Monaco view zone immediately before the conflict block. The content widget can then render inside that reserved space or the row can be rendered as the zone DOM itself.

This creates a visible row with no line number, matching the desired behavior and the existing result-editor alignment approach. It also prevents action labels from hiding source text.

Alternative considered: Move all region actions to a fixed toolbar. That avoids overlap but loses the useful inline association between each action and the exact conflict block.

### Decision: Align side panes by conflict-region visual coordinates

The surface should preserve shared scrolling, but it should make the scrollable content coordinate systems comparable before sharing raw `scrollTop`. For normal Monaco side panes, add display-only alignment zones so matching conflict regions occupy comparable vertical positions even when one side contains fewer lines than the other.

The alignment input should come from existing side-region projection, which maps result conflict ids to each side's real line range. For each conflict id, calculate the side line counts and add display-only padding to the shorter side around that region. The padding must be purely visual and must not affect line numbers or source text.

Alternative considered: Transform `scrollTop` from one side to the other using per-region mapping. That can work but is harder to reason about with Monaco internals, content widgets, manually revealed regions, and range-loaded panes. Making the visual coordinate systems comparable keeps the current synchronization model simpler.

### Decision: Preserve result synchronization but prioritize side alignment

The current surface synchronizes `Incoming`, `Current`, and `Result` through one scroll value. This change should avoid removing result synchronization unless implementation or testing shows that result syncing creates worse review behavior. The must-have alignment target is the two read-only side panes, because those are the panes users compare directly.

Alternative considered: Fully decouple the result editor. That may be a good future preference, but it would change established behavior beyond the requested visual-alignment polish.

### Decision: Treat range-loaded panes as bounded parity

Very large files use range-loaded virtualized panes rather than full Monaco models. They should receive the same side/result color identity and should reserve a visible action strip without obscuring code. Precise per-region padding should be applied only when the required range and region data are available without defeating range loading.

Alternative considered: Force very large panes into Monaco for full view-zone parity. That conflicts with the existing large-file responsiveness requirement.

## Risks / Trade-offs

- View zones can desynchronize with content widgets after content, accepted-state, or active-region changes -> keep zone ids in refs, recreate zones from current regions, and add cleanup tests.
- Extra visual padding can confuse users if it looks like real code -> style alignment/action zones distinctly and keep line-number gutters empty.
- Side-specific colors can compete with syntax colors -> use low-opacity fills and stronger accents only in headers, rulers, and narrow borders.
- Scroll synchronization can jitter if programmatic scroll updates re-emit events -> preserve the existing syncing guard and test that programmatic updates do not loop.
- Range-loaded panes may not fully align every off-screen region -> document bounded parity and keep normal-sized Monaco panes as the primary exact behavior.

## Migration Plan

1. Add conflict-side visual metadata and apply it to headers, side decorations, result accepted regions, and range-loaded row highlights.
2. Add side-pane view-zone management for action rows in normal Monaco panes.
3. Add side-pane visual alignment padding for normal Monaco panes using projected side-region line counts.
4. Extend range-loaded panes with matching color identity and non-overlapping action presentation.
5. Add or update colocated Vitest tests for visual metadata usage, action-zone creation/removal, side alignment zones, and scroll synchronization.

Rollback is straightforward: remove the new view-zone/alignment behavior and return to existing content-widget-only actions and raw scroll synchronization. No data migration is required.

## Open Questions

- Should a later change add a user-facing toggle for linked result scrolling if users prefer the result editor to remain independent?
