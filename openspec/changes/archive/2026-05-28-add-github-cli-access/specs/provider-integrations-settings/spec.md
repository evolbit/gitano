## MODIFIED Requirements

### Requirement: GitHub connection is configured from Integrations
The system SHALL require GitHub provider connection state and access method selection to be managed from the settings `Integrations` section.

#### Scenario: User selects GitHub CLI access
- **WHEN** the user selects GitHub CLI as the GitHub access method
- **THEN** Gitano MUST use the user's external `gh` installation for GitHub PR operations
- **AND** Gitano MUST NOT require Gitano OAuth to be connected
- **AND** Gitano MUST NOT install `gh`

#### Scenario: GitHub CLI is not installed
- **WHEN** the GitHub CLI access method is selected or inspected
- **AND** Gitano cannot execute `gh --version`
- **THEN** Gitano MUST show that GitHub CLI is not installed
- **AND** Gitano MUST explain that `gh` must be installed externally
- **AND** GitHub CLI-backed PR actions MUST be disabled

#### Scenario: GitHub CLI is installed outside the bundled app PATH
- **WHEN** Gitano is running as a bundled desktop app
- **AND** `gh` is installed in a platform-standard external binary directory such as Homebrew on macOS
- **THEN** Gitano MUST locate and execute `gh` using platform fallback search paths
- **AND** Gitano MUST pass the expanded search path to `gh` commands

#### Scenario: GitHub CLI is not authenticated
- **WHEN** GitHub CLI is installed
- **AND** `gh` is not authenticated for `github.com`
- **THEN** Gitano MUST show that GitHub CLI is installed but not authenticated
- **AND** Gitano MUST tell the user to authenticate with `gh auth login`
- **AND** GitHub CLI-backed PR actions MUST be disabled

#### Scenario: GitHub CLI is ready
- **WHEN** GitHub CLI is installed and authenticated
- **AND** `gh api user` returns account identity
- **THEN** Gitano MUST show GitHub CLI as ready
- **AND** Gitano MUST show the authenticated account identity when available

### Requirement: Provider integration model is extensible
The system SHALL model settings integrations as providers with independently reportable access methods.

#### Scenario: GitHub access methods are listed
- **WHEN** settings requests provider integration data
- **THEN** the GitHub provider entry MUST include OAuth and GitHub CLI access method status
- **AND** the GitHub provider entry MUST include the selected access method
- **AND** the selected access method MUST support OAuth-only, GitHub-CLI-only, and automatic fallback modes
