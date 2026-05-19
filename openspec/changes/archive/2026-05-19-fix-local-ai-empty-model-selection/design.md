## Context

The settings modal already renders `---` for unset action-specific model preferences. The previous fix changed the frontend to send `modelId: null`, and the Rust request type was updated to accept `Option<String>`. In a running desktop app, however, the already-loaded backend command may still have the older `String` request shape, so selecting `---` fails before command logic can clear the preference.

## Goals / Non-Goals

**Goals:**

- Make action-specific model clearing work against both the older string-based command signature and the newer nullable signature.
- Keep the settings modal error behavior unchanged: settings command errors stay inside the modal.
- Avoid changing global default rules.

**Non-Goals:**

- Remove nullable backend support.
- Rework the settings modal layout.
- Re-enable local AI result caching.

## Decisions

### Decision: Use an empty string as the wire clear value

The frontend should send `modelId: ""` when the user selects `---` for an action-specific preference. The backend model preference logic already treats empty or whitespace-only model ids as a clear request when an `actionKind` is present. This payload also deserializes successfully for older backends that still expect a string.

Alternative considered: keep sending `null`. That is semantically clean for the newer backend, but it fails at the Tauri argument boundary for the currently running older command shape.

### Decision: Keep nullable backend compatibility

The Rust command can continue accepting `Option<String>` and normalizing `None` to `""`. This preserves compatibility with any client that already sends `null`, while the production UI uses the string payload for broader compatibility.

Alternative considered: revert the Rust type to `String`. That would fix the immediate UI issue but remove tolerance for nullable callers.

## Risks / Trade-offs

- Empty string is less semantically precise than `null` -> centralize it in the settings handler and tests so the intent stays clear.
- A backend older than the action-clear logic would still reject empty strings as unsupported models -> current code keeps backend clear handling in place and tests it.
