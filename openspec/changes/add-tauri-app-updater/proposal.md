## Why

Gitano currently requires users to manually download and install a new desktop
bundle for every release. Adding the official Tauri updater gives the app a
clear, signed update path for test builds now and public releases later.

## What Changes

- Add Tauri updater support so Gitano can check for, download, verify, and
  install newer app versions.
- Produce Tauri updater artifacts during release builds, including the signed
  macOS app archive used by the updater.
- Document the release and update process, including required signing keys,
  update metadata, artifact hosting, and macOS Gatekeeper/code-signing
  expectations.
- Define an initial update distribution contract for hosting version metadata
  and platform artifacts on a server or static release host.
- Keep binary-delta updates out of scope for this change; the initial updater
  downloads the full signed platform update artifact produced by Tauri.

## Capabilities

### New Capabilities

- `app-self-updates`: Runtime behavior for checking, presenting, downloading,
  verifying, and installing app updates.

### Modified Capabilities

- `desktop-app-packaging`: Release packaging must produce and document signed
  Tauri updater artifacts and the metadata/hosting requirements needed for
  update distribution.

## Impact

- Tauri configuration and Rust dependencies for `tauri-plugin-updater`.
- Frontend update-check UI and typed platform adapter boundaries.
- Release documentation for update signing keys, endpoint metadata, artifact
  upload/hosting, test install flows, and public macOS signing/notarization.
- CI or release scripts may need follow-up work to build, sign, and publish
  updater artifacts.
