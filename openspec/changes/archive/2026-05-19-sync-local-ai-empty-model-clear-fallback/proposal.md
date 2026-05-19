## Why

The empty action-model option is fixed by making the frontend resilient to already-running backends that still reject empty model ids. The spec needs to record that compatibility behavior before archiving the fix.

## What Changes

- Document the string-compatible empty model clear request for action-specific model selectors.
- Document the frontend fallback that preserves the cleared action state when an older backend rejects the empty model id.
- Keep the global default model rules unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-ai-model-management`: Clarify action-specific model clearing and older-backend compatibility behavior.

## Impact

- OpenSpec only: syncs the implemented Local AI settings fallback behavior into the main model-management spec.
