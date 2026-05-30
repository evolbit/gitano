## Context

Gitano is a Tauri 2 desktop app with release bundling enabled, but it does not
currently include `tauri-plugin-updater`, updater configuration, updater
artifacts, or release documentation for publishing update metadata. Users must
download a fresh installer manually for every new version.

Tauri's updater model downloads signed platform update artifacts. On macOS that
means the updater uses the signed `.app.tar.gz` artifact, not the DMG. The
Tauri updater signature is required for update verification and is separate from
Apple Developer ID code signing/notarization.

## Goals / Non-Goals

**Goals:**

- Enable Gitano to check for and install updates using the official Tauri 2
  updater plugin.
- Keep updater calls behind a typed, mockable frontend adapter instead of
  calling plugin APIs directly from React components.
- Provide a small user-facing update surface from the app shell or settings
  area that can report available, unavailable, downloading, ready-to-restart,
  and error states.
- Produce Tauri updater artifacts during release builds.
- Document the required update server/static host contract, including metadata,
  artifact URLs, updater signatures, and macOS signing expectations.
- Support local/manual testing from an unsigned or ad-hoc-signed macOS install
  while documenting the limits of that path.

**Non-Goals:**

- Differential or binary-delta updates.
- A custom patching protocol.
- A hosted update service implementation beyond documenting the endpoint and
  artifact hosting contract.
- Automatic background installation without a user-visible prompt.

## Decisions

### Use the official Tauri updater plugin first

Add `tauri-plugin-updater` on the Rust side and `@tauri-apps/plugin-updater` on
the frontend side, then configure Tauri to create updater artifacts.

Alternatives considered:

- Custom binary patching: rejected for the first increment because it adds
  signing, rollback, patch compatibility, and platform installer complexity.
- Manual "open download page" flow: simpler, but does not solve the product
  goal of in-app updates.

### Treat update signing and Apple signing as separate release concerns

The update artifact MUST be signed with the Tauri updater signing key. Public
macOS releases SHOULD also use Apple Developer ID signing and notarization, but
test builds can document the current unsigned/ad-hoc install path with the
expected Gatekeeper caveats.

Alternatives considered:

- Require Apple notarization before any updater work: rejected because local
  updater testing should be possible before public distribution is finalized.
- Omit macOS signing guidance: rejected because it would make the release
  process ambiguous and fragile for downloaded apps.

### Use a static update endpoint contract

Document a version metadata endpoint that can be served from a static host,
release bucket, or GitHub release-backed URL. The app should be configured with
one or more updater endpoints and the docs must describe which files are
uploaded for each target platform.

Alternatives considered:

- Build a custom update server now: unnecessary until release needs require
  staged rollout, channels, authentication, or telemetry.
- Hard-code GitHub release URLs in UI code: rejected because endpoint selection
  belongs in Tauri/release configuration.

### Keep frontend update logic feature-owned and platform calls shared

Create an app-update feature for UI/hook state and a shared Tauri updater
adapter for plugin calls. Use TanStack Query or local mutation state for checks
and installs rather than storing fetched update state globally.

Alternatives considered:

- Call updater plugin APIs directly from components: rejected because platform
  calls must remain mockable and centralized.
- Store update metadata in Zustand: unnecessary for a short-lived server state
  workflow.

## Risks / Trade-offs

- Unsigned or non-notarized macOS builds may still trigger Gatekeeper warnings
  after installation or update -> document the test-only workflow and require
  signing/notarization for public releases.
- Update endpoint metadata can point to missing or mismatched artifacts -> add
  release documentation and validation tasks that cover artifact/signature
  presence before publishing.
- Losing the Tauri updater private key would prevent publishing trusted updates
  for the existing app key -> document key generation, storage, and rotation
  implications.
- Full-artifact downloads are larger than binary deltas -> accept this for the
  first increment and measure release artifact size before considering a custom
  delta system.
- Installing an update interrupts the running desktop session -> require a
  user-visible restart/install prompt rather than silent installation.

## Migration Plan

1. Add updater dependencies and configuration.
2. Add the shared adapter and app-update feature UI.
3. Add tests for adapter mapping, update states, and user interactions.
4. Add release documentation for update signing, artifacts, metadata, hosting,
   local test flow, and public macOS signing.
5. Build a test release, upload metadata/artifacts to a test endpoint, install
   the older app, and verify update installation.

Rollback is disabling the updater endpoint/configuration in a release and
removing the app update entry point. Already published versions will continue to
trust the configured updater public key, so key handling must be deliberate.

## Open Questions

- Which static host should be used first for update metadata and artifacts:
  GitHub Releases, a dedicated object storage bucket, or another release host?
- Should Gitano check automatically on startup, only manually from Settings, or
  both with a rate limit?
- Do we need release channels such as stable, beta, and nightly in the first
  implementation?
