## Why

Gitano needs a paid-access model before distribution so free users can keep core Git workflows while premium users unlock AI features. The first license flow should support local license import, regular validity checks, and backend-enforced AI entitlement without requiring sign-in for normal app launch.

## What Changes

- Add a license management surface reachable from the application menu as `License`.
- Add local `.gitano-license` import from a file, storing the imported license for future launches.
- Add signed-license verification using an embedded public key, including signature, expiry, machine fingerprint, plan, and feature checks.
- Add regular server validation for imported licenses so Gitano can detect revoked, expired, cancelled, or moved licenses.
- Add license status APIs for frontend UX and backend feature guards.
- Gate premium AI features behind license entitlements while preserving free access to core Git workflows.
- Replace the current Local AI development entitlement stub with the new license-backed entitlement path.

## Capabilities

### New Capabilities

- `license-management`: Covers license import, local signed-license verification, regular server validation, machine-bound activation status, and license UI access from the application menu.

### Modified Capabilities

- `local-ai-git-analysis`: AI Git actions must require a valid premium AI entitlement before repository context is processed.
- `local-ai-model-management`: Local AI setup, model management, runtime preparation, and preferences must require a valid premium AI entitlement where they enable AI execution.
- `external-ai-agents`: External AI agent installation, configuration, authentication, and execution must require a valid premium AI entitlement.
- `branch-ai-review`: Branch AI review must require a valid premium AI entitlement before review context is generated or findings are produced.

## Impact

- Frontend: application menu, app shell modal state, new license feature UI, entitlement-aware AI controls, tests for locked/unlocked states.
- Shared API/platform: new typed Tauri adapters for license status, import, validation refresh, and feature entitlement status.
- Backend: new Rust licensing module for stored license loading, public-key signature verification, fingerprint checks, expiry checks, validation refresh, and centralized premium feature guards.
- Existing AI backend commands: replace Local AI-specific development stub guards with license feature guards for premium AI capabilities.
- Infrastructure boundary: activation/validation server endpoints are called only for import/regular validation; local app launch and command gating use the stored signed license when valid.
