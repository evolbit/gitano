## Context

`ChangesExplorer` currently mixes pure helper logic, derived file/tree shaping, staging state orchestration, menu handling, and row rendering in one large component. The application has already shown that moving refresh logic or render boundaries carelessly can introduce scroll lag or rerender churn, so this refactor must improve readability without changing the reactive surface area of the explorer.

## Goals / Non-Goals

**Goals:**
- Split `ChangesExplorer` into smaller, easier-to-read modules.
- Keep component-local utilities local unless they are actually shared elsewhere.
- Use hooks only for stateful or effect-driven behavior that benefits from being isolated.
- Extract hot row and menu rendering into memoizable module boundaries without changing visible behavior.
- Preserve current explorer behavior, including flat/tree mode, folder expansion, staging, context menus, and modal rebinding.

**Non-Goals:**
- No user-facing behavior changes.
- No new virtualization or rendering model changes.
- No new polling or backend refresh behavior changes.
- No global utility migration unless a helper is already shared by multiple components.

## Decisions

### Keep pure helpers in the component folder unless they are shared
`normalizeFiles`, `partitionFiles`, checkbox state helpers, selection serialization, and similar transforms should move into `changes-explorer/utils.ts` if they remain local to the component. They should not be promoted to global utilities unless another component actually reuses them.

**Why:** local helpers are still easier to find when they stay with their owning component, and extracting them does not create new render boundaries.

**Alternatives considered:** moving everything into shared `src/utils/` modules. Rejected because it increases cognitive distance and tends to encourage premature abstraction.

### Prefer hooks only for stateful behavior
If the component needs scroll reveal scheduling, menu positioning, outside-click dismissal, or refresh debouncing, those behaviors can move into `changes-explorer/hooks.ts`. Pure data transforms should remain plain functions.

**Why:** hooks are useful for encapsulating effects and state, but using hooks for stateless transforms adds indirection without value.

**Alternatives considered:** converting all helpers to hooks. Rejected because hooks are the wrong abstraction for pure data shaping and can make rerender behavior harder to reason about.

### Extract hot rendering into memoizable row/menu modules
Row renderers and menu content should be split into separate module-level components so they can be memoized and kept stable. The parent explorer should continue to own the data subscriptions and the primary state.

**Why:** this keeps the file readable while avoiding the trap of moving subscriptions into many tiny child components.

**Alternatives considered:** splitting into many small stateful child components. Rejected because it increases rerender risk and makes the scroll hot path harder to reason about.

### Keep the parent as the state owner
`ChangesExplorer.tsx` should remain the owner of the core explorer state and data flow, with children receiving derived props rather than subscribing to their own slices of state unless there is a compelling performance reason.

**Why:** a single state owner keeps rerenders predictable and reduces the chance of multiple independent subscriptions fighting each other.

**Alternatives considered:** moving search/expansion/staging/menu state into separate components. Rejected because that would likely worsen the render graph before it improves readability.

## Risks / Trade-offs

- [Risk] Splitting the file too aggressively could increase rerenders if child components subscribe independently.
  - [Mitigation] Keep state subscriptions in the parent and make extracted children pure/memoized renderers.
- [Risk] The file may still feel large after only extracting pure helpers and renderers.
  - [Mitigation] Use a minimal `hooks.ts` only if the resulting parent component remains hard to read.
- [Risk] Overusing hooks for simple helpers would make the code harder to understand.
  - [Mitigation] Reserve hooks for state/effects and keep pure transforms as plain utilities.
- [Risk] A refactor that changes prop identity or render structure can reintroduce scroll lag.
  - [Mitigation] Keep props primitive where possible, memoize row components, and avoid introducing extra subscriptions in the hot path.

## Migration Plan

1. Extract local pure helper functions into `changes-explorer/utils.ts`.
2. Extract row renderers into memoizable module-level components.
3. Extract menu rendering into a separate module if the parent remains dense.
4. Only add `changes-explorer/hooks.ts` for state/effect logic that is actually worth isolating after the first two steps.
5. Validate that scroll performance and behavior remain unchanged after each step.

## Open Questions

- Which extracted pieces should remain in the parent component because they are too hot to move?
- Is a `hooks.ts` file necessary after the first pass, or will `utils.ts` plus row/menu modules be enough?
- Should any of the existing helper functions eventually become shared utilities, or should they stay local to preserve clarity?
