# toolbar-remote-actions Specification

## Purpose
TBD - created by archiving change add-toolbar-pull-and-push-actions. Update Purpose after archive.
## Requirements
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

#### Scenario: User pushes a current branch without upstream tracking
- **WHEN** the active branch has no configured upstream
- **AND** the user activates a toolbar or commit-box push action
- **THEN** the system MUST push the active branch to `origin`
- **AND** the system MUST set `origin/<branch>` as the active branch upstream

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

### Requirement: Toolbar push action surfaces operation status
The system SHALL provide explicit push status feedback for user-initiated push actions across all push entry points.

#### Scenario: User triggers push from toolbar
- **WHEN** the user triggers a push from the toolbar
- **THEN** the push control MUST show push-specific loading only for the duration of that push action
- **THEN** the system MUST show push success or failure feedback using the shared push messaging pattern

#### Scenario: User triggers commit and push from commit box
- **WHEN** the user triggers commit+push from the current changes commit box
- **THEN** the system MUST reuse the same push success and failure feedback behavior used by toolbar push
- **THEN** the toolbar push control MUST show push-specific loading only while the push operation is executing

### Requirement: Toolbar branch and tag context reacts to repository-change events
The system SHALL refresh branch/tag-dependent toolbar context from repository-change events.

#### Scenario: Branch refs change
- **WHEN** backend events indicate `branches` or `head` changes for the active repository
- **THEN** the toolbar branch context MUST refresh without requiring manual branch-menu reopening
- **THEN** push target context derived from active branch selection MUST stay consistent with refreshed refs

#### Scenario: Tag refs change
- **WHEN** backend events indicate `tags` changes for the active repository
- **THEN** toolbar data sources that expose or depend on tag metadata MUST refresh from the latest repository state

#### Scenario: Unrelated repository changes occur
- **WHEN** backend events are received without `branches`, `head`, or `tags` kinds
- **THEN** toolbar branch/tag refresh MUST NOT run solely because unrelated change kinds were emitted
