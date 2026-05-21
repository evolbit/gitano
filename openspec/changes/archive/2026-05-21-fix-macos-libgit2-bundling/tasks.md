## 1. Native Git Dependency Configuration

- [x] 1.1 Update `src-tauri/Cargo.toml` so `git2` enables `vendored-libgit2` for portable macOS bundles.
- [x] 1.2 Evaluate whether `vendored-openssl` is needed by inspecting packaged dynamic dependencies; enable it if package-manager OpenSSL paths remain.
- [x] 1.3 Refresh `src-tauri/Cargo.lock` after dependency feature changes.
- [x] 1.4 Verify the Rust dependency graph shows the intended vendored native dependency features.

## 2. macOS Bundle Dependency Verification

- [x] 2.1 Add a macOS release verification script that accepts an optional path to `gitano.app/Contents/MacOS/gitano` and otherwise uses the default Tauri bundle path.
- [x] 2.2 Make the verification script fail clearly when the packaged executable is missing.
- [x] 2.3 Make the verification script run `otool -L` and reject package-manager `libgit2` install names such as `/opt/homebrew` or `/usr/local`.
- [x] 2.4 Treat an absent `libgit2` dylib line as success because vendored static linking is acceptable.
- [x] 2.5 Add a package or documented command for running the macOS dependency verification before release.

## 3. Release Artifact Verification

- [x] 3.1 Run `cargo check` in `src-tauri` to verify the Rust manifest and lockfile changes compile.
- [x] 3.2 Build the macOS Tauri bundle on macOS.
- [x] 3.3 Run the macOS dependency verification against the built `.app` executable.
- [x] 3.4 Confirm the verification output contains no `/opt/homebrew`, `/usr/local`, or other package-manager `libgit2` references.

## 4. Regression Coverage

- [x] 4.1 Run the relevant Rust tests for Git operations if available.
- [x] 4.2 Run the frontend build or existing app build command to ensure packaging-related config changes do not break the normal build.
- [x] 4.3 Document the release verification command in the implementation notes or repository documentation touched by the change.
