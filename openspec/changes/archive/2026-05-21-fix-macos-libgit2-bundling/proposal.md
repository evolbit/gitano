## Why

Gitano can currently build a macOS app that launches on the developer machine but crashes immediately on another machine because the binary references Homebrew's `libgit2` path (`/opt/homebrew/*/libgit2.1.9.dylib`). Release builds must not depend on Homebrew or any other developer-local dynamic library being installed on the user's computer.

## What Changes

- Make macOS release bundles self-contained for the native Git dependency used through Rust `git2` / `libgit2-sys`.
- Prevent packaged app binaries from referencing `/opt/homebrew`, `/usr/local`, or other build-machine package manager paths for `libgit2`.
- Add a release validation step that inspects the built `.app` executable and fails if it still has an external `libgit2` install name.
- Document the intended dependency strategy so future Git-related dependency updates do not reintroduce non-portable dynamic links.
- Keep runtime behavior unchanged for Git operations; this change only fixes packaging and launch reliability.

## Capabilities

### New Capabilities
- `desktop-app-packaging`: Desktop release bundles are self-contained for native runtime dependencies and can launch on machines without developer toolchain packages installed.

### Modified Capabilities
- None.

## Impact

- Rust/Tauri manifest: `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`, specifically the `git2` / `libgit2-sys` dependency configuration.
- macOS bundle verification: release or build scripts/tests that can inspect `src-tauri/target/*/bundle/macos/gitano.app/Contents/MacOS/gitano` with macOS dynamic library tooling.
- Tauri packaging: `src-tauri/tauri.conf.json` only if additional bundled files or configuration become necessary.
- CI/release process: add a check that would catch missing native dependency bundling before distributing the app.
