## Purpose

Define Gitano license management behavior for local signed license import, local verification, regular validation refresh, and premium feature entitlement checks.

## Requirements

### Requirement: License management is available from the application menu
The system SHALL expose license management from the same application menu that contains Settings.

#### Scenario: User opens license management
- **WHEN** the user opens the application menu
- **THEN** the menu MUST include a `License` item
- **AND** selecting `License` MUST open the license management window

#### Scenario: License window shows current status
- **WHEN** the license management window opens
- **THEN** the window MUST show whether Gitano is running as free or premium
- **AND** it MUST show the current license status when a license has been imported
- **AND** it MUST show whether AI premium features are currently available

### Requirement: Users can import a local license file
The system SHALL allow users to import a local signed license file and validate it with the license validation service before premium access is stored.

#### Scenario: User imports a valid license file
- **WHEN** the user selects a `.gitano-license` file
- **AND** the license validation service accepts the license for the current machine fingerprint
- **THEN** Gitano MUST store the license for future app launches
- **AND** Gitano MUST update the license window to show premium access
- **AND** premium AI feature checks MUST pass

#### Scenario: User imports an invalid license file
- **WHEN** the user selects a file that is missing required license fields, cannot be parsed, or is rejected by the license validation service
- **THEN** Gitano MUST reject the license
- **AND** Gitano MUST preserve the previously stored valid license if one exists
- **AND** Gitano MUST show a clear error in the license window

#### Scenario: User imports a license already assigned to another machine
- **WHEN** the user selects a license whose active server-side assignment belongs to a different machine fingerprint
- **THEN** Gitano MUST reject the license
- **AND** Gitano MUST explain that the license is assigned to another machine

#### Scenario: Import validation request is sent
- **WHEN** the user imports a license file
- **THEN** Gitano MUST send the license and current machine fingerprint to the license validation service
- **AND** Gitano MUST store premium access only from a server-returned signed entitlement

### Requirement: Imported licenses are verified locally
The system SHALL verify stored server-returned entitlements locally using embedded public keys before trusting any entitlement payload fields.

#### Scenario: App starts with a stored license
- **WHEN** Gitano starts and a server-returned entitlement is stored locally
- **THEN** Gitano MUST verify the entitlement signature with the embedded public key identified by the entitlement key id
- **AND** Gitano MUST verify the entitlement has not expired
- **AND** Gitano MUST verify the entitlement machine fingerprint matches the current machine
- **AND** Gitano MUST derive premium feature access only after all local checks pass

#### Scenario: Stored license payload was modified
- **WHEN** Gitano starts with a stored license whose payload no longer matches its signature
- **THEN** Gitano MUST treat the license as invalid
- **AND** Gitano MUST keep premium AI features locked

#### Scenario: License public key is unknown
- **WHEN** Gitano reads a stored entitlement signed with an unknown key id
- **THEN** Gitano MUST treat the license as invalid
- **AND** Gitano MUST explain that the license cannot be verified by this version of Gitano

### Requirement: License validation is refreshed regularly
The system SHALL regularly validate imported licenses against the license validation service so server-side license changes can affect local premium access.

#### Scenario: Stored license is within validation grace period
- **WHEN** Gitano starts with a locally valid stored license whose last successful validation is within the configured grace period
- **THEN** Gitano MAY enable premium AI features immediately
- **AND** Gitano SHOULD refresh validation in the background

#### Scenario: Stored license is outside validation grace period
- **WHEN** Gitano starts with a locally valid stored license whose last successful validation is outside the configured grace period
- **THEN** Gitano MUST require a successful validation refresh before premium AI commands are allowed
- **AND** the license window MUST show that validation is required

#### Scenario: Validation service reports revoked license
- **WHEN** the validation service reports that the stored license is revoked, cancelled, refunded, expired, disabled, or assigned to another active machine
- **THEN** Gitano MUST mark the local license invalid for premium access
- **AND** premium AI feature checks MUST fail
- **AND** the license window MUST show the server-provided reason when available

#### Scenario: Validation service returns a refreshed signed license
- **WHEN** the validation service accepts the current license and returns a refreshed signed license
- **THEN** Gitano MUST verify the refreshed license locally before storing it
- **AND** Gitano MUST update the last successful validation time only after verification succeeds

### Requirement: License status is exposed through typed platform APIs
The system SHALL expose license status, import, and refresh operations through typed Tauri adapters.

#### Scenario: Frontend requests license status
- **WHEN** the frontend requests license status
- **THEN** the backend MUST return the current plan, license state, entitled premium features, validation state, expiry date when present, and user-facing reason when access is unavailable

#### Scenario: Frontend imports a license
- **WHEN** the frontend sends an import request for a selected license file
- **THEN** the request MUST go through a typed shared API adapter
- **AND** React components MUST NOT parse or verify the license file directly

#### Scenario: Frontend refreshes validation
- **WHEN** the frontend requests a license validation refresh
- **THEN** the request MUST go through a typed shared API adapter
- **AND** the backend MUST own validation request payload construction

### Requirement: Premium feature checks are centralized
The system SHALL centralize premium feature checks so feature gates use named semantic feature constants instead of raw string literals.

#### Scenario: Backend checks premium AI access
- **WHEN** a backend command needs access to premium AI functionality
- **THEN** it MUST check access through a centralized licensing guard
- **AND** it MUST identify the requested premium feature using a named Rust enum or constant

#### Scenario: Frontend renders a premium AI control
- **WHEN** the frontend renders an AI control that requires premium access
- **THEN** it MUST derive locked or unlocked state from the shared license status model
- **AND** it MUST identify the requested premium feature using a named TypeScript constant or union value
