## ADDED Requirements

### Requirement: App update availability can be checked from Gitano
The system SHALL provide a user-accessible way to check whether a newer Gitano
version is available through the configured update endpoint.

#### Scenario: Newer version is available
- **WHEN** the user checks for updates and the update endpoint reports a newer compatible version
- **THEN** the app MUST show that an update is available
- **AND** the app MUST show enough version information for the user to understand what will be installed

#### Scenario: No newer version is available
- **WHEN** the user checks for updates and the update endpoint reports no newer compatible version
- **THEN** the app MUST show that the installed version is up to date

#### Scenario: Update check cannot complete
- **WHEN** the user checks for updates and the endpoint is unavailable, invalid, or unreachable
- **THEN** the app MUST show a recoverable error state
- **AND** the app MUST allow the user to try again without restarting Gitano

### Requirement: App updates require user-visible installation flow
The system SHALL require a user-visible action before downloading and installing
an available app update.

#### Scenario: User starts an available update
- **WHEN** an update is available and the user chooses to install it
- **THEN** the app MUST download the update artifact
- **AND** the app MUST keep the user informed that the update is in progress

#### Scenario: Update is ready to apply
- **WHEN** the update artifact has downloaded and verified successfully
- **THEN** the app MUST make the required restart or relaunch action clear to the user

#### Scenario: User declines an available update
- **WHEN** an update is available and the user does not choose to install it
- **THEN** the app MUST leave the current running version unchanged

### Requirement: App updates are verified before installation
The system SHALL install only update artifacts that pass the updater
verification required by Tauri.

#### Scenario: Update signature verification succeeds
- **WHEN** the downloaded update artifact matches the configured updater signature
- **THEN** the app MAY proceed with the installation flow

#### Scenario: Update signature verification fails
- **WHEN** the downloaded update artifact does not pass updater signature verification
- **THEN** the app MUST NOT install the update
- **AND** the app MUST show a recoverable error state

### Requirement: App update platform calls are mockable
The system SHALL keep app update platform calls behind a typed adapter boundary.

#### Scenario: React update UI checks for updates
- **WHEN** React update UI needs to check, download, or install an update
- **THEN** it MUST use the typed update adapter
- **AND** it MUST NOT call raw Tauri updater APIs directly from React components

#### Scenario: Update behavior is tested
- **WHEN** update UI or hooks are tested
- **THEN** tests MUST be able to mock update checks, downloads, install success, and install failure at the adapter boundary
