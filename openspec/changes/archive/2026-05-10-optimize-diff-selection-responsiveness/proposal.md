## Why

Line and block selection in the working-tree diff viewer feel laggy even for single clicks, and drag selection amplifies the problem. The current selection path updates staged state at file scope, which causes broad rerenders and repeated derived diff work for every interaction.

This makes the staging UI feel less direct than the GitHub Desktop-style interaction the app is aiming for.

## What Changes

- Optimize working-tree diff selection so single-click and drag interactions feel immediate.
- Narrow selection-driven rerenders so toggling one line does not force the entire diff file view to recompute unnecessarily.
- Reduce repeated derived work in diff hunk rendering.
- Preserve the existing staging semantics and Git index sync behavior.

## Capabilities

### New Capabilities
- `diff-selection-responsiveness`: keeps editable diff selection responsive under single-click and drag interactions.

### Modified Capabilities
- `edit-diff-selection-gutters`: selection gutters must remain visually and behaviorally unchanged while becoming more responsive.
- `immediate-index-staging`: immediate staging must continue to work without making each selection interaction feel heavy.

## Impact

- Affected code:
  - `src/components/DiffViewer.tsx`
  - `src/components/DiffHunk.tsx`
  - `src/store/staging.ts`
  - any nearby selection/render helpers introduced to reduce recomputation
- No backend contract changes are required.
- No UI behavior changes are intended beyond responsiveness.
