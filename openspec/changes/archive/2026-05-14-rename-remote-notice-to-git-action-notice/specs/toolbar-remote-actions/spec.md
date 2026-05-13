## RENAMED Requirements
- FROM: `### Requirement: Remote-operation feedback is shown in a bottom snackbar`
- TO: `### Requirement: Git-action feedback is shown in a bottom snackbar`

## MODIFIED Requirements

### Requirement: Git-action feedback is shown in a bottom snackbar
The system SHALL display git-action feedback using a compact bottom snackbar, with success and failure using the same surface differently.

#### Scenario: Pull, fetch, push, stash, or pop succeeds
- **WHEN** any supported git action that reports through shared action feedback succeeds
- **THEN** the system MUST show a compact success snackbar near the bottom of the workspace
- **THEN** the success snackbar MUST include a success indicator and short operation-specific message
- **THEN** the success snackbar SHOULD dismiss automatically after a short timeout

#### Scenario: Pull, fetch, push, stash, or pop fails
- **WHEN** any supported git action that reports through shared action feedback fails
- **THEN** the system MUST show a compact snackbar near the bottom of the workspace
- **THEN** the compact snackbar MUST include a short operation-specific failure message
- **THEN** the failure snackbar SHOULD remain visible longer than the success snackbar

#### Scenario: User expands failure details
- **WHEN** the user opens the snackbar details
- **THEN** the system MUST reveal the full backend error text for that operation

#### Scenario: A new action result arrives while feedback is visible
- **WHEN** a second supported git action completes while a previous snackbar is still visible
- **THEN** the system MUST replace the displayed notice with the latest action result
- **THEN** snackbar dismissal timing MUST be recalculated from the latest result type
