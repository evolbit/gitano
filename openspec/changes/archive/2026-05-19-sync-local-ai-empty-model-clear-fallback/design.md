## Context

The current implementation sends `modelId: ""` when the user selects `---` for an action-specific model. Updated backends treat that as a clear request. If an already-running older backend rejects it with `Unsupported local AI model:`, the frontend still clears the selector locally and applies that override when preferences are loaded.

## Goals / Non-Goals

**Goals:**

- Capture the implemented compatibility fallback in OpenSpec.
- Preserve the distinction between action-specific clears and global default selection.
- Keep settings errors scoped to the modal while not surfacing stale-backend clear failures as user-facing errors.

**Non-Goals:**

- Change the implementation again.
- Change runtime/model download behavior.
- Re-enable AI result caching.

## Decisions

### Decision: Document frontend-side compatibility override

The spec should state that an action clear remains effective in the settings UI even when a stale backend rejects the clear request. This reflects the shipped behavior and prevents future regressions that would reintroduce the raw `Unsupported local AI model:` error for the `---` option.

## Risks / Trade-offs

- The fallback is a compatibility bridge for old running backends, not the primary persistence path. The backend remains responsible for durable preference persistence once the updated command is active.
