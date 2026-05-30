## 1. Tauri Updater Setup

- [x] 1.1 Add Rust and frontend updater plugin dependencies.
- [x] 1.2 Register the Tauri updater plugin in the app startup code.
- [x] 1.3 Configure updater endpoints, updater public key, and updater artifact generation in Tauri config.
- [x] 1.4 Confirm local development builds still run when updater configuration is present.

## 2. Update Platform Adapter

- [x] 2.1 Add a typed shared updater adapter that wraps Tauri updater check, download, and install APIs.
- [x] 2.2 Centralize updater status and error constants near the updater domain.
- [x] 2.3 Add adapter tests that mock available, unavailable, verification failure, download failure, and install-ready outcomes.

## 3. App Update UI

- [x] 3.1 Add an app-update feature with hooks or mutation state for checking and installing updates.
- [x] 3.2 Add a compact update surface in the existing app shell or settings experience.
- [x] 3.3 Show unavailable, available, checking, downloading, ready-to-restart, declined, and error states.
- [x] 3.4 Ensure install/update actions require an explicit user action and do not silently interrupt the app.
- [x] 3.5 Add colocated tests for the update UI and interaction states.

## 4. Release Documentation

- [x] 4.1 Document how to generate and store the Tauri updater signing key pair.
- [x] 4.2 Document the update metadata endpoint contract and required artifact uploads for each platform.
- [x] 4.3 Document the macOS release distinction between initial-install DMGs and updater `.app.tar.gz` artifacts.
- [x] 4.4 Document local testing from unsigned or ad-hoc-signed macOS builds, including Gatekeeper caveats.
- [x] 4.5 Document public macOS signing and notarization expectations in addition to Tauri updater signing.
- [x] 4.6 Document the manual release flow for building, validating, uploading artifacts, and testing an update from an older installed version.

## 5. Verification

- [x] 5.1 Run `pnpm run lint`.
- [x] 5.2 Run `pnpm test`.
- [x] 5.3 Run `pnpm run build`.
- [x] 5.4 Run `cargo test` from `src-tauri`.
- [x] 5.5 Build a macOS release artifact and run `pnpm verify:macos-bundle-deps`.
- [ ] 5.6 Verify a test update by installing an older local build, hosting update metadata/artifacts on a test endpoint, and updating to the newer build.
