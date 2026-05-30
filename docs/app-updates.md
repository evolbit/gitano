# App Updates

Gitano uses the official Tauri updater. The updater downloads a full signed
platform artifact and verifies it before installation. It does not perform
binary-delta updates.

## Current Endpoint

The app is configured to check this static update metadata file:

```text
https://github.com/evolbit/gitano/releases/latest/download/latest.json
```

Before publishing real updates, replace the placeholder updater public key in
`src-tauri/tauri.conf.json` with the public key generated for Gitano releases.
The endpoint can stay on GitHub Releases, or it can be changed to another HTTPS
static host or dynamic update server.

Production builds enforce HTTPS updater endpoints. Do not enable insecure
transport for public releases.

## Signing Keys

Tauri updater signatures are required and cannot be disabled. They are separate
from Apple Developer ID signing and notarization.

Generate the updater key pair once:

```bash
pnpm tauri signer generate -w ~/.tauri/gitano-updater.key
```

This creates:

```text
~/.tauri/gitano-updater.key      private key, keep secret
~/.tauri/gitano-updater.key.pub  public key, commit the contents in tauri.conf.json
```

The private key is required when building updater artifacts:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/gitano-updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
pnpm tauri build
```

Losing the private key means already-installed builds that trust the committed
public key cannot receive future trusted updates from a replacement key.

## Artifacts

The DMG is for initial macOS installation. The updater does not download the
DMG. With `bundle.createUpdaterArtifacts` enabled, Tauri also creates updater
artifacts.

For macOS, publish:

```text
src-tauri/target/release/bundle/macos/gitano.app.tar.gz
src-tauri/target/release/bundle/macos/gitano.app.tar.gz.sig
```

For Linux AppImage releases, publish:

```text
src-tauri/target/release/bundle/appimage/*.AppImage
src-tauri/target/release/bundle/appimage/*.AppImage.sig
```

For Windows releases, publish the generated installer and matching `.sig` file
from the MSI or NSIS bundle directory.

## Static Metadata

`latest.json` must contain a SemVer version and a platform map. The `signature`
value is the contents of the generated `.sig` file, not a path or URL.

Example:

```json
{
  "version": "0.2.0",
  "notes": "Release notes for Gitano 0.2.0",
  "pub_date": "2026-05-30T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "contents of gitano.app.tar.gz.sig",
      "url": "https://github.com/evolbit/gitano/releases/download/v0.2.0/gitano_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "contents of gitano.app.tar.gz.sig",
      "url": "https://github.com/evolbit/gitano/releases/download/v0.2.0/gitano_x64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "contents of the Windows installer .sig file",
      "url": "https://github.com/evolbit/gitano/releases/download/v0.2.0/gitano-setup.exe"
    },
    "linux-x86_64": {
      "signature": "contents of the AppImage .sig file",
      "url": "https://github.com/evolbit/gitano/releases/download/v0.2.0/gitano.AppImage"
    }
  }
}
```

Tauri validates the whole static metadata file before checking the version. If a
platform entry exists, its URL and signature must be valid.

## macOS Signing

Local testing can use an unsigned or ad-hoc-signed DMG if the tester manually
allows Gitano through Gatekeeper. The installed app can still check and install
Tauri-signed updater artifacts.

That test flow does not replace public macOS signing. Public macOS releases
should use Apple Developer ID signing and notarization in addition to Tauri
updater signing. Without signing/notarization, downloaded apps can trigger
Gatekeeper warnings or be blocked.

## Manual Release Flow

1. Bump the version consistently in `package.json`, `src-tauri/Cargo.toml`, and
   `src-tauri/tauri.conf.json`.
2. Ensure `src-tauri/tauri.conf.json` contains the real updater public key.
3. Export `TAURI_SIGNING_PRIVATE_KEY` and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
4. Run `pnpm install` if dependencies changed.
5. Run `pnpm run lint`, `pnpm test`, `pnpm run build`, and `cargo test` from
   `src-tauri`.
6. Run `pnpm tauri build`.
7. Run `pnpm verify:macos-bundle-deps` for macOS bundles.
8. Upload initial-install bundles, updater artifacts, and matching `.sig` files
   to the release host.
9. Publish or update `latest.json`.
10. Install an older Gitano build, open the update menu, check for updates,
    install the update, and restart Gitano.

If `latest.json` is not uploaded or the configured endpoint is unreachable,
Gitano can run normally but cannot discover updates.
