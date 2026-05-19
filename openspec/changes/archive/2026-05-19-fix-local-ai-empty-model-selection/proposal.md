## Why

Selecting the `---` action-model option in Local AI settings can send `null` to a running backend command that still expects a string payload, producing an argument-deserialization error instead of clearing the action preference. The settings UI needs a backwards-compatible clear payload so users can unset action-specific models without waiting for a backend restart or newer command signature.

## What Changes

- Send the empty string for action-model clear requests instead of `null`.
- Keep backend support for nullable model ids so newer clients and tests remain valid.
- Update frontend API typing and tests to make the backwards-compatible empty-string clear payload explicit.
- Preserve the existing rule that global default cannot be unset manually.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-ai-model-management`: Clarify that action-specific clears must use a backend-compatible clear payload accepted by both string and nullable command contracts.

## Impact

- Frontend settings modal preference handling.
- Frontend local AI API request type and tests.
- No data migration, runtime behavior change, or new dependency.
