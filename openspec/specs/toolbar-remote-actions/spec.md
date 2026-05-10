# toolbar-remote-actions Specification

## Purpose
TBD - created by archiving change add-toolbar-pull-and-push-actions. Update Purpose after archive.
## Requirements
### Requirement: Toolbar pull and push actions are actionable
The system SHALL make the workspace toolbar `Pull` and `Push` controls executable for the current repository context.

#### Scenario: User clicks the pull primary action
- **WHEN** the user activates the main `Pull` action area
- **THEN** the system MUST execute the currently selected default pull/fetch operation for the active repository

#### Scenario: User clicks the push action
- **WHEN** the user activates the `Push` action area
- **THEN** the system MUST attempt to push the active branch to its configured remote target

### Requirement: Pull exposes a persisted default strategy
The system SHALL allow the user to choose a default pull/fetch strategy from the toolbar and persist that selection globally across repositories.

#### Scenario: User opens the pull strategy menu
- **WHEN** the user opens the pull dropdown menu
- **THEN** the system MUST show the available default pull/fetch operations

#### Scenario: User changes the pull strategy
- **WHEN** the user selects a different default pull/fetch operation
- **THEN** the system MUST persist that selection
- **THEN** the persisted selection MUST be reused when the user switches repositories or restarts the app

### Requirement: Toolbar action tiles are fully clickable and hoverable
The system SHALL treat the toolbar remote action tiles as unified interactive surfaces.

#### Scenario: User targets a remote action tile
- **WHEN** the user hovers or clicks a toolbar remote action
- **THEN** the label and icon region MUST behave as one actionable surface
- **THEN** the hover state MUST visually communicate that the control is interactive

#### Scenario: User hovers push
- **WHEN** the user hovers the `Push` action
- **THEN** the system SHOULD communicate the push target context, such as the configured remote/branch destination

### Requirement: Remote-operation feedback is shown in a bottom snackbar
The system SHALL display toolbar remote-operation feedback using a compact bottom snackbar, with success and failure using the same surface differently.

#### Scenario: Pull, fetch, or push succeeds
- **WHEN** a toolbar remote operation succeeds
- **THEN** the system MUST show a compact success snackbar near the bottom of the workspace
- **THEN** the success snackbar MUST include a success indicator and short operation-specific message
- **THEN** the success snackbar SHOULD dismiss automatically after a short timeout

#### Scenario: Pull, fetch, or push fails
- **WHEN** a toolbar remote operation fails
- **THEN** the system MUST show a compact snackbar near the bottom of the workspace
- **THEN** the compact snackbar MUST include a short operation-specific failure message
- **THEN** the failure snackbar SHOULD remain visible longer than the success snackbar

#### Scenario: User expands failure details
- **WHEN** the user opens the snackbar details
- **THEN** the system MUST reveal the full backend error text for that operation

