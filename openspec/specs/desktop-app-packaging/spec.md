## Purpose

Describe desktop release packaging behavior, including native runtime dependency
portability and macOS bundle validation before distribution.

## Requirements

### Requirement: macOS release bundles are self-contained for native Git dependencies
The system SHALL produce macOS application bundles that do not require user machines to have developer-machine package-manager copies of native Git libraries installed.

#### Scenario: User launches Gitano on a machine without Homebrew libgit2
- **WHEN** a user installs and launches a macOS release build of Gitano on a machine without Homebrew `libgit2`
- **THEN** the app MUST launch without a dyld missing-library crash for `libgit2`

#### Scenario: Packaged executable is inspected
- **WHEN** the packaged macOS executable is inspected for dynamic library dependencies
- **THEN** it MUST NOT reference `/opt/homebrew`, `/usr/local`, or another build-machine package-manager path for `libgit2`
- **AND** it MUST either statically include `libgit2` or reference a library path that is bundled with the app or provided by macOS

#### Scenario: Native Git dependency is upgraded
- **WHEN** the Rust `git2` or `libgit2-sys` dependency is upgraded
- **THEN** the release dependency verification MUST still confirm that the packaged macOS executable does not depend on a package-manager `libgit2` path

### Requirement: macOS bundle dependency validation is release-visible
The system SHALL provide a repeatable validation step that catches non-portable native library references before distributing a macOS build.

#### Scenario: Release validation finds an external libgit2 dependency
- **WHEN** release validation detects that the packaged executable references Homebrew, MacPorts, or another package-manager `libgit2` path
- **THEN** validation MUST fail
- **AND** validation MUST print enough dependency details to identify the offending install name

#### Scenario: Release validation finds no external libgit2 dependency
- **WHEN** release validation inspects a packaged executable that does not reference an external package-manager `libgit2`
- **THEN** validation MUST pass

#### Scenario: Packaged executable is missing
- **WHEN** release validation cannot find the expected macOS app executable
- **THEN** validation MUST fail with a clear message that the bundle must be built before dependency validation can run
