## MODIFIED Requirements

### Requirement: Toolbar pull and push actions are actionable
The system SHALL make the workspace toolbar `Pull` and `Push` controls executable for the current repository context and selected default operation.

#### Scenario: User clicks the pull primary action
- **WHEN** the user activates the main `Pull` action area
- **THEN** the system MUST execute the currently selected default pull/fetch operation for the active repository

#### Scenario: User clicks the push action
- **WHEN** the user activates the `Push` action area
- **THEN** the system MUST execute the currently selected default push operation for the active repository
- **THEN** branch-only push mode MUST attempt to push the active branch to its configured remote target
- **THEN** branch-and-tags push mode MUST attempt to push the active branch and then publish local tags
- **THEN** the push action MUST NOT delete remote tags

## ADDED Requirements

### Requirement: Fetch exposes tag and prune modes
The system SHALL make toolbar fetch operations fetch tags by default and expose pruning as a separate explicit option.

#### Scenario: User runs Fetch All
- **WHEN** the selected pull/fetch operation is `Fetch All + Tags`
- **AND** the user activates the toolbar Pull action
- **THEN** the system MUST fetch all configured remotes
- **THEN** the system MUST fetch tags
- **THEN** the system MUST refresh repository ref views after success

#### Scenario: User runs Fetch All with prune
- **WHEN** the selected pull/fetch operation is `Fetch All + Tags + Prune`
- **AND** the user activates the toolbar Pull action
- **THEN** the system MUST fetch all configured remotes
- **THEN** the system MUST fetch tags
- **THEN** the system MUST prune stale remote-tracking branches and stale local tag refs
- **THEN** the system MUST refresh repository ref views after success

### Requirement: Push exposes a persisted default mode
The system SHALL allow the user to choose a default push mode from the toolbar and persist that selection globally across repositories.

#### Scenario: User opens the push mode menu
- **WHEN** the user opens the push dropdown menu
- **THEN** the system MUST show `Push current branch` and `Push current branch with tags` options
- **THEN** the system MUST indicate the currently selected default push mode

#### Scenario: User changes the push mode
- **WHEN** the user selects a different default push mode
- **THEN** the system MUST persist that selection
- **THEN** the persisted selection MUST be reused when the user switches repositories or restarts the app

#### Scenario: User keeps the default push mode
- **WHEN** the user has not changed the push mode
- **THEN** the toolbar Push action MUST default to `Push current branch`

### Requirement: Toolbar push-with-tags publishes without pruning origin tags
The system SHALL make toolbar push-with-tags publish local tags without deleting tags from `origin`.

#### Scenario: User pushes current branch with tags
- **WHEN** the selected push mode is `Push current branch with tags`
- **AND** the user activates the toolbar Push action
- **THEN** the system MUST push the active branch
- **THEN** the system MUST publish local tags after the branch push succeeds
- **THEN** the system MUST include lightweight tags in the tag-publishing step
- **THEN** the system MUST NOT delete tags from `origin` that are missing locally

#### Scenario: Branch push fails before tag publishing
- **WHEN** the selected push mode is `Push current branch with tags`
- **AND** the branch push fails
- **THEN** the system MUST NOT attempt the tag-publishing step
- **THEN** the system MUST show push failure feedback with backend error details

#### Scenario: Tag publishing fails after branch push succeeds
- **WHEN** the selected push mode is `Push current branch with tags`
- **AND** the branch push succeeds
- **AND** the tag-publishing step fails
- **THEN** the system MUST show push failure feedback with backend error details
- **THEN** the feedback MUST make clear that the branch push may have completed before tag publishing failed
