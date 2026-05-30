## ADDED Requirements

### Requirement: Release builds produce Tauri updater artifacts
The system SHALL produce the signed update artifacts required by the Tauri
updater for each distributed desktop platform.

#### Scenario: macOS release build is created
- **WHEN** a macOS release build is produced for update distribution
- **THEN** the release output MUST include the Tauri macOS app update archive
- **AND** the release output MUST include the updater signature for that archive
- **AND** the release process MUST distinguish the updater archive from the DMG used for initial installation

#### Scenario: Updater artifact signature is missing
- **WHEN** a release is prepared for update distribution and an updater artifact is missing its updater signature
- **THEN** the release MUST NOT be considered ready for publishing

#### Scenario: Existing macOS dependency validation is run for release builds
- **WHEN** a macOS release is prepared with updater artifacts
- **THEN** the existing macOS native dependency validation MUST still be run before distribution

### Requirement: Update distribution hosting is documented
The system SHALL document the hosting contract required for Gitano to discover
and download app updates.

#### Scenario: Release maintainer publishes an app update
- **WHEN** a release maintainer prepares an app update
- **THEN** documentation MUST identify the metadata endpoint that Gitano checks for update availability
- **AND** documentation MUST identify where platform update artifacts and updater signatures are uploaded
- **AND** documentation MUST describe the relationship between metadata entries, artifact URLs, versions, and signatures

#### Scenario: Static hosting is used for update distribution
- **WHEN** update metadata and artifacts are hosted on a static server, object storage bucket, or release asset host
- **THEN** documentation MUST describe the files that need to be uploaded
- **AND** documentation MUST describe how the app is configured to read that endpoint

#### Scenario: Update endpoint is not configured
- **WHEN** a build is produced without an update endpoint
- **THEN** documentation MUST make clear that the build cannot discover updates until an endpoint is configured

### Requirement: Update signing requirements are documented
The system SHALL document the signing requirements for trusted app updates.

#### Scenario: Tauri updater signing is configured
- **WHEN** release maintainers configure app updates
- **THEN** documentation MUST describe the Tauri updater public key configured into the app
- **AND** documentation MUST describe the private key or secret required to sign update artifacts
- **AND** documentation MUST state that Tauri updater signatures are required for update installation

#### Scenario: macOS test build is installed from an unsigned DMG
- **WHEN** a tester installs Gitano from an unsigned or ad-hoc-signed DMG and manually allows it through Gatekeeper
- **THEN** documentation MUST state that updater testing can still use Tauri-signed update artifacts
- **AND** documentation MUST state that this does not replace Apple code signing or notarization for public distribution

#### Scenario: Public macOS release is prepared
- **WHEN** a macOS release is prepared for public distribution
- **THEN** documentation MUST require Apple Developer ID signing and notarization expectations in addition to Tauri updater signing
