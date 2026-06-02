## 1. Licensing Backend Foundation

- [x] 1.1 Create a Rust licensing module with typed license envelope, payload, plan, status, validation state, and premium feature enums.
- [x] 1.2 Implement license storage loading and saving in Gitano-owned app data without exposing parsing to React.
- [x] 1.3 Implement embedded public-key lookup by key id and signed payload verification.
- [x] 1.4 Implement backend-owned machine fingerprint generation and matching against the signed license payload.
- [x] 1.5 Implement expiry, validation grace-period, last-validation, and suspicious clock rollback checks.
- [x] 1.6 Add Rust unit tests for valid license, invalid signature, unknown key id, wrong machine, expired license, stale validation, and rollback cases.

## 2. License Validation API

- [x] 2.1 Add backend commands for license status, license file import, and validation refresh.
- [x] 2.2 Add validation service client boundaries that submit backend-owned validation payloads and verify refreshed signed licenses before storage.
- [x] 2.3 Add typed frontend adapters in `src/shared/api` for license status, import, and refresh commands.
- [x] 2.4 Add adapter and command tests for success, parse failure, rejected license, stale validation, and server-revoked status.

## 3. License UI

- [x] 3.1 Add a `License` item to the application menu beside `Settings`.
- [x] 3.2 Add app-shell state and wiring for opening and closing a license management window.
- [x] 3.3 Build the license management window showing free/premium state, AI entitlement availability, expiry, validation state, and user-facing reasons.
- [x] 3.4 Add local `.gitano-license` file import flow through the backend command.
- [x] 3.5 Add manual validation refresh action and loading/error states.
- [x] 3.6 Add frontend tests for menu entry, window open/close, valid import, invalid import, stale validation, and locked/unlocked status rendering.

## 4. Premium AI Enforcement

- [x] 4.1 Replace the Local AI development entitlement stub with centralized license-backed premium AI guards.
- [x] 4.2 Guard local AI Git action commands before repository AI context is built.
- [x] 4.3 Guard local AI setup, runtime preparation, model preparation, model warming, and AI preference mutation commands.
- [x] 4.4 Guard external AI agent install, remove, authenticate, logout, session configuration, selection, preference, and run commands.
- [x] 4.5 Ensure branch AI review requests fail before branch review context or draft feedback is created when entitlement is unavailable.
- [x] 4.6 Add backend tests proving locked AI commands do not prepare repository context or invoke local/external AI execution.

## 5. Entitlement-Aware Frontend AI UX

- [x] 5.1 Load license status where AI setup/settings and AI action surfaces need locked/unlocked state.
- [x] 5.2 Update Local AI setup and settings panes to show premium-required state when AI entitlement is unavailable.
- [x] 5.3 Update external agent controls to preserve preferences but block installation, configuration, selection, and execution while locked.
- [x] 5.4 Update commit, branch analysis, branch review, and merge-conflict AI entry points to show license-required messaging instead of runtime errors.
- [x] 5.5 Add frontend tests for locked AI controls and restored controls after valid license status.

## 6. Verification

- [x] 6.1 Run `pnpm run lint`.
- [x] 6.2 Run `pnpm test`.
- [x] 6.3 Run `pnpm run build`.
- [x] 6.4 Run `cargo test` from `src-tauri`.
- [ ] 6.5 Manually verify the `License` window at narrow and desktop widths.
