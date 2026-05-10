## Overview

The lag comes from state granularity and render breadth, not from the staging semantics themselves. A single line toggle currently updates staged selection at file scope, which causes the whole diff viewer for that file to rerender. During those rerenders, each hunk recalculates stageable blocks, split rows, and row selection state.

This change keeps the current interaction model and Git index sync behavior, but reduces how much UI work happens per selection event.

## Goals

- Make single-line selection feel immediate.
- Keep drag selection responsive across large hunks.
- Preserve current unified/split rendering behavior and selection semantics.
- Preserve immediate Git index staging after interactions complete.

## Non-Goals

- Changing backend diff formats.
- Changing block/line/file selection semantics.
- Redesigning the diff viewer layout.

## Design Decisions

### 1. Narrow staged selection subscriptions

The diff viewer should stop treating the entire file-level staged selection object as one reactive unit for rendering. Selection state should be read at a narrower granularity so updating one hunk does not force every hunk to rerender.

Preferred direction:
- subscribe per hunk or equivalent derived slice
- avoid passing a large mutable staged-selection map through every hunk render

### 2. Memoize hunk-level derived data

Derived data such as:
- stageable blocks
- split rows
- block membership lookups

should be memoized per hunk so they are not rebuilt on every unrelated selection change.

### 3. Keep drag interaction local until sync point

Drag selection may still update visible selection state as the gesture moves, but it should avoid unnecessary repeated expensive work. The UI should update locally during the gesture, then keep the existing backend sync point on mouseup.

### 4. Preserve immediate staging semantics

This change does not revert to deferred staging. Git index updates should still occur at the existing sync points; the optimization is about reducing frontend work before and around those syncs.

## Implementation Notes

- `DiffViewer` is the current source of broad rerenders because it subscribes to staged lines at file scope.
- `DiffHunk` should become more memo-friendly and avoid recomputing static hunk structure from scratch on every selection change.
- If helper structures are introduced, they should be derived from hunk contents, not from transient pointer state.

## Risks

- Over-memoization could hide legitimate updates if props are not normalized carefully.
- Narrower subscriptions may require reshaping how staged state is stored or accessed.
- Drag interactions must remain correct while reducing render work.
