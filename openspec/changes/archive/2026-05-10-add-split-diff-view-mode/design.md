## Context

The current diff viewer is structurally unified: each rendered row contains old line number, new line number, content, and the editable staging gutters in a single row stream. The staging model already uses stable `hunkIdx + lineIdx` identities, which means the same selection semantics can be preserved even if the diff is rendered differently.

The requested split view is not just a style toggle. It requires transforming a hunk's unified diff lines into paired left/right visual rows while keeping the same underlying selection model. The user also wants split mode to place the block and line selection gutters in the center seam between old and new panes, while unified mode should keep the current left-gutter layout.

## Goals / Non-Goals

**Goals:**
- Add a display mode state for `unified` and `split` in the shared diff viewer.
- Render split mode as side-by-side old/new panes with center seam selection gutters.
- Preserve the current file, block, and line staging semantics across both modes.
- Ensure block selection in split mode visually and behaviorally selects the full logical block across both sides.

**Non-Goals:**
- Redesign the backend diff format or Git staging commands.
- Introduce intraline diff rendering, whitespace-mode changes, or new syntax-diff behavior.
- Rework the existing changes explorer, modal layout, or staging rules beyond what is required for split rendering.

## Decisions

### 1. Keep one diff data model and add two renderers
The diff viewer will continue to consume the existing hunk and line data from the backend. The change will add a display mode state and two presentation paths:
- unified renderer: current single-stream layout
- split renderer: derived paired rows built from the same `hunk.lines`

This keeps the data contract stable and avoids introducing a second backend-specific diff format.

### 2. Split mode will derive visual rows from unified hunk lines
Split mode needs an explicit transformation step that converts `hunk.lines` into split-view rows with:
- optional left cell content
- optional right cell content
- stable references back to the original `lineIdx`
- block metadata so the center seam gutter can target the same logical block

This transformation is the core design choice because it separates visual pairing from staging identity.

### 3. Selection identity remains `hunkIdx + lineIdx`
Block and line staging will continue using the existing line identity model. Both unified and split renderers will call the same handlers for:
- line selection
- block selection
- staged-state checks

This preserves immediate staging behavior and avoids inventing a second staging model for split rows.

### 4. Gutter placement becomes mode-specific
Unified mode keeps the current gutter layout on the left side of the row.

Split mode moves:
- block selection gutter
- line selection gutter

into the center seam between left and right panes, matching the requested layout. The block gutter remains tied to the logical block, not to only the left or only the right rendered side.

## Risks / Trade-offs

- **Split-row pairing can look imperfect for uneven add/delete sequences** → Start with deterministic pairing from unified diff order and refine only if the initial behavior proves confusing.
- **Drag staging in split mode touches two visual panes** → Keep one underlying line identity model so drag behavior still maps to the same staged line set.
- **Mode-specific gutter placement increases component complexity** → Keep the selection logic shared and isolate the difference in rendering helpers rather than forking the staging flow.
- **Large hunks can make split layout width tighter** → Reuse existing diff container scrolling behavior and treat width tuning as follow-up polish if needed.
