## Purpose

Define provider integration settings, including connection state, OAuth-backed provider setup, and extensible provider rows.

## Requirements

### Requirement: Settings exposes provider integrations
The system SHALL expose provider integrations in settings through a dedicated `Integrations` section.

#### Scenario: User opens settings
- **WHEN** the settings window is open
- **THEN** the settings navigation MUST include an `Integrations` section
- **AND** the section MUST list available provider integrations
- **AND** GitHub MUST be listed as the initial provider integration

#### Scenario: Provider is disconnected
- **WHEN** a listed provider is not connected
- **THEN** the provider row MUST show a disconnected status
- **AND** the provider row MUST offer a connect action
- **AND** the provider row MUST NOT expose pull request actions directly

#### Scenario: Provider is connected
- **WHEN** a listed provider is connected
- **THEN** the provider row MUST show a connected status
- **AND** the provider row MUST show the connected account identity when available
- **AND** the provider row MUST offer a disconnect action

### Requirement: GitHub connection is configured from Integrations
The system SHALL require GitHub provider connection state to be managed from the settings `Integrations` section.

#### Scenario: User connects GitHub
- **WHEN** the user starts the GitHub connect flow from settings
- **THEN** Gitano MUST start a GitHub OAuth device authorization flow
- **AND** Gitano MUST show the GitHub verification URL and user code
- **AND** Gitano MUST poll or allow completion checks without asking the user to paste a token

#### Scenario: User authorizes GitHub
- **WHEN** GitHub returns an OAuth access token for the device authorization flow
- **THEN** Gitano MUST verify the connection with GitHub
- **AND** Gitano MUST persist the credential through backend-owned secure storage
- **AND** Gitano MUST update the GitHub provider row to connected after verification succeeds

#### Scenario: GitHub OAuth is not configured
- **WHEN** the user starts the GitHub connect flow without a configured GitHub OAuth client id
- **THEN** Gitano MUST keep GitHub disconnected
- **AND** Gitano MUST show a concise setup failure state

#### Scenario: GitHub connection verification fails
- **WHEN** Gitano cannot verify the GitHub connection
- **THEN** the GitHub provider row MUST remain disconnected
- **AND** the provider row MUST show a concise failure state
- **AND** detailed failure information MUST be available without exposing secrets

#### Scenario: User disconnects GitHub
- **WHEN** the user disconnects the GitHub provider from settings
- **THEN** Gitano MUST remove the stored GitHub credential
- **AND** Gitano MUST mark GitHub as disconnected
- **AND** GitHub pull request surfaces MUST stop using the previous credential

### Requirement: Provider integration model is extensible
The system SHALL model settings integrations as providers rather than GitHub-specific one-off settings.

#### Scenario: Settings loads provider integrations
- **WHEN** settings requests provider integration data
- **THEN** the response MUST identify each provider by a stable provider id
- **AND** each provider MUST include a display name, connection state, and supported capabilities
- **AND** GitHub-specific data MUST be scoped to the GitHub provider entry

#### Scenario: Future providers are added
- **WHEN** a future provider is added to the provider catalog
- **THEN** the settings `Integrations` section MUST be able to render it as another provider row
- **AND** existing GitHub connection behavior MUST NOT require structural changes to support the new provider row
