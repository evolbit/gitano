## ADDED Requirements

### Requirement: GitHub pull requests are listed for the active repository
The system SHALL list GitHub pull requests for the active repository when the repository remote resolves to GitHub and the GitHub provider is connected.

#### Scenario: User opens the pull request modal
- **WHEN** the active repository remote resolves to a GitHub repository
- **AND** the GitHub provider is connected
- **AND** the user opens the pull request modal
- **THEN** Gitano MUST load open pull requests for that GitHub repository
- **AND** the modal MUST present pull request rows in a dense list or table layout

#### Scenario: Repository is not hosted on GitHub
- **WHEN** the active repository remote does not resolve to a GitHub repository
- **AND** the user opens the pull request modal
- **THEN** Gitano MUST show that GitHub pull requests are unavailable for the repository
- **AND** Gitano MUST NOT call GitHub pull request list APIs for that repository

#### Scenario: GitHub is not connected
- **WHEN** the active repository remote resolves to a GitHub repository
- **AND** the GitHub provider is disconnected
- **AND** the user opens the pull request modal
- **THEN** Gitano MUST explain that GitHub must be connected in settings
- **AND** the modal MUST provide a path to the settings `Integrations` section

### Requirement: Pull request list uses GitHub-native review actions
The system SHALL present GitHub-native review actions for each pull request.

#### Scenario: Pull request row is shown
- **WHEN** a pull request row is rendered
- **THEN** the row MUST show the pull request status, title, number, author or reviewer identity when available, repository and branch context, and line change counts when available
- **AND** the row MUST expose `Review`, `Approve`, and `Request changes` actions

#### Scenario: User chooses Review
- **WHEN** the user activates `Review` for a pull request
- **THEN** Gitano MUST open the pull request in the branch comparison review surface
- **AND** the comparison MUST use the pull request base and head context

#### Scenario: User chooses Approve
- **WHEN** the user activates `Approve` for a pull request
- **THEN** Gitano MUST open a confirmation modal
- **AND** the modal MUST include a Markdown comment composer
- **AND** submitting the modal MUST create an `APPROVE` review on GitHub

#### Scenario: User chooses Request changes
- **WHEN** the user activates `Request changes` for a pull request
- **THEN** Gitano MUST open a confirmation modal
- **AND** the modal MUST include a Markdown comment composer
- **AND** submitting the modal MUST create a `REQUEST_CHANGES` review on GitHub

### Requirement: GitHub review submission reports action state
The system SHALL report GitHub pull request review submission outcomes using the existing workspace feedback pattern.

#### Scenario: Review submission succeeds
- **WHEN** GitHub accepts an approve, request changes, or comment-only review submission
- **THEN** Gitano MUST show a compact success message
- **AND** Gitano MUST refresh the affected pull request data
- **AND** Gitano MUST refresh the pending pull request count for the repository

#### Scenario: Review submission fails
- **WHEN** GitHub rejects an approve, request changes, or comment-only review submission
- **THEN** Gitano MUST show a compact failure message
- **AND** detailed GitHub error information MUST be available in the action log
- **AND** Gitano MUST NOT clear local draft review comments that were not submitted

### Requirement: Pull request count refresh is regular and scoped
The system SHALL regularly refresh pending pull request counts for active GitHub repositories.

#### Scenario: Active repository tab has a GitHub remote
- **WHEN** a repository tab with a GitHub remote is active
- **AND** the GitHub provider is connected
- **THEN** Gitano MUST fetch the pending pull request count for that repository
- **AND** Gitano MUST refresh that count on a regular interval while the repository remains active

#### Scenario: Active repository changes
- **WHEN** the active repository tab changes
- **THEN** Gitano MUST show any cached pending pull request count for the new active repository if available
- **AND** Gitano MUST request a fresh pending count for the new active repository when eligible

#### Scenario: Count refresh fails
- **WHEN** a pending pull request count refresh fails
- **THEN** Gitano MUST preserve the last successful count if one exists
- **AND** Gitano MUST avoid blocking existing Git toolbar actions
- **AND** repeated refresh failures MUST NOT spam the user with repeated modal errors

#### Scenario: Repository is ineligible for GitHub PRs
- **WHEN** the active repository does not have a GitHub remote or GitHub is disconnected
- **THEN** Gitano MUST NOT run periodic GitHub pull request count refresh for that repository
