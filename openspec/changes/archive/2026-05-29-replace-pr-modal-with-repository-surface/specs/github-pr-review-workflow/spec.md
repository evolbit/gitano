## ADDED Requirements

### Requirement: Pull request workflows render as a repository surface
The system SHALL render pull request list and review workflows as an inline repository surface instead of a modal overlay from the repository toolbar.

#### Scenario: User switches from workspace to pull requests
- **WHEN** the active repository can show pull requests
- **AND** the user activates the toolbar pull request control from the normal workspace
- **THEN** Gitano MUST replace the repository workspace body with the pull requests surface
- **AND** Gitano MUST keep the repository toolbar visible
- **AND** Gitano MUST NOT render the pull request list through a modal portal or blocking overlay

#### Scenario: User switches from pull requests to workspace
- **WHEN** the pull requests surface is active for a repository
- **AND** the user activates the toolbar workspace-return control
- **THEN** Gitano MUST replace the pull requests surface with the normal repository workspace
- **AND** Gitano MUST restore the repository workspace from that repository's stored UI state

#### Scenario: User reviews a pull request from the pull request list
- **WHEN** the user activates `Review` for a pull request row in the pull requests surface
- **THEN** Gitano MUST switch the pull requests surface to review mode for that pull request
- **AND** Gitano MUST NOT open a separate pull request review modal

#### Scenario: User returns from review to pull request list
- **WHEN** pull request review mode is active
- **AND** the user activates PR-surface navigation back to the list
- **THEN** Gitano MUST show the pull request list inside the same pull requests surface
- **AND** Gitano MUST preserve the review UI state for that pull request for the current app session

### Requirement: Toolbar pull request control reflects repository surface state
The system SHALL make the top toolbar pull request control reflect and change the active surface for the current repository.

#### Scenario: Normal workspace is active
- **WHEN** the normal workspace surface is active for the current repository
- **THEN** the toolbar control MUST present the pull request entry action
- **AND** the control MUST include the pending pull request count when a count is available

#### Scenario: Pull request surface is active
- **WHEN** the pull requests surface is active for the current repository
- **THEN** the toolbar control MUST present a workspace-return action
- **AND** activating the control MUST return only the current repository to its normal workspace surface

#### Scenario: User switches repositories with different active surfaces
- **WHEN** repository A is showing the pull requests surface
- **AND** repository B is showing the normal workspace surface
- **AND** the user switches between those repository tabs
- **THEN** the toolbar control MUST update to match the active surface of the newly active repository

## MODIFIED Requirements

### Requirement: GitHub pull requests are listed for the active repository
The system SHALL list GitHub pull requests for the active repository using the selected GitHub access method when the repository remote resolves to GitHub.

#### Scenario: User opens the pull request surface
- **WHEN** the active repository remote resolves to a GitHub repository
- **AND** the selected GitHub access method is available
- **AND** the user opens the pull request surface
- **THEN** Gitano MUST load open pull requests for that GitHub repository
- **AND** the surface MUST present pull request rows in a dense list or table layout
- **AND** row text MUST truncate with ellipsis instead of overflowing the table columns

#### Scenario: GitHub CLI access method is selected
- **WHEN** the active repository remote resolves to a GitHub repository
- **AND** the GitHub access method is GitHub CLI
- **AND** GitHub CLI is ready
- **AND** the user opens the pull request surface
- **THEN** Gitano MUST load open pull requests through `gh`
- **AND** the surface MUST present the same pull request row data shape used by OAuth-backed loading

#### Scenario: Automatic fallback handles OAuth access policy failure
- **WHEN** the GitHub access method is automatic fallback
- **AND** OAuth-backed pull request loading fails because the OAuth app cannot access the organization repository
- **AND** GitHub CLI is ready
- **THEN** Gitano MUST retry the operation through GitHub CLI
- **AND** Gitano MUST avoid prompting the user to reconnect OAuth for that operation

#### Scenario: Repository is not hosted on GitHub
- **WHEN** the active repository remote does not resolve to a GitHub repository
- **AND** the user opens the pull request surface
- **THEN** Gitano MUST show that GitHub pull requests are unavailable for the repository
- **AND** Gitano MUST NOT call GitHub pull request list APIs for that repository

#### Scenario: GitHub is not connected
- **WHEN** the active repository remote resolves to a GitHub repository
- **AND** no selected GitHub access method is available
- **AND** the user opens the pull request surface
- **THEN** Gitano MUST explain that GitHub must be configured in settings
- **AND** the surface MUST provide a path to the settings `Integrations` section

### Requirement: Pull request list uses GitHub-native review actions
The system SHALL present GitHub-native review actions for each pull request.

#### Scenario: Pull request row is shown
- **WHEN** a pull request row is rendered
- **THEN** the row MUST show the pull request status, title, number, author or reviewer identity when available, repository and branch context, and line change counts when available
- **AND** the row MUST expose `Review`, merge, and `Request changes` actions

#### Scenario: User chooses Review
- **WHEN** the user activates `Review` for a pull request
- **THEN** Gitano MUST open the pull request in review mode inside the pull requests surface
- **AND** the comparison MUST use the pull request base and head context

#### Scenario: User chooses Request changes
- **WHEN** the user activates `Request changes` for a pull request
- **THEN** Gitano MUST open a confirmation modal
- **AND** the modal MUST include a Markdown comment composer
- **AND** submitting the modal MUST create a `REQUEST_CHANGES` review on GitHub
