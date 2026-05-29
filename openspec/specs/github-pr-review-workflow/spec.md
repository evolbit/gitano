## Purpose

Define GitHub pull request listing, conversation, review actions, review submission feedback, merge actions, and scoped pull request count refresh behavior.

## Requirements

### Requirement: Pull request workflows render as a repository surface
The system SHALL render pull request list and review workflows as an inline repository surface instead of a modal overlay from the repository toolbar.

#### Scenario: User switches from workspace to pull requests
- **WHEN** the active repository can show pull requests
- **AND** the user activates the toolbar pull request control from the normal workspace
- **THEN** Gitano MUST present the pull requests surface in the repository workspace body
- **AND** Gitano MUST keep the repository toolbar visible
- **AND** Gitano MUST NOT render the pull request list through a modal portal or blocking overlay

#### Scenario: User switches from pull requests to workspace
- **WHEN** the pull requests surface is active for a repository
- **AND** the user activates the toolbar workspace-return control
- **THEN** Gitano MUST present the normal repository workspace for that repository
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

### Requirement: Pull request review comments can be submitted from draft threads
The system SHALL allow draft review threads created in pull request review mode to be submitted through the selected GitHub access method.

#### Scenario: GitHub CLI submits PR review comments
- **WHEN** the GitHub access method is GitHub CLI
- **AND** the user submits draft review comments
- **THEN** Gitano MUST submit line comments, file comments, replies, and pending edits through structured `gh` commands
- **AND** Gitano MUST preserve the same validation behavior used by OAuth-backed submission

#### Scenario: GitHub CLI resolves review threads
- **WHEN** the GitHub access method is GitHub CLI
- **AND** the user resolves or reopens a review thread
- **THEN** Gitano MUST persist the review thread state through `gh api graphql`
- **AND** Gitano MUST report failures through the global action notice

### Requirement: Pull request review mode shows the pull request conversation
The system SHALL show pull request conversation history inside pull request review mode.

#### Scenario: User opens the pull request conversation
- **WHEN** the user opens the pull request review screen
- **AND** the user activates `Conversation`
- **THEN** Gitano MUST show the pull request description, commits, conversation comments, review comments, and review replies in the main review area
- **AND** Markdown content MUST render GitHub-flavored tables, links, images, headings, code, and common GitHub emoji shortcodes

#### Scenario: User adds a pull request conversation comment
- **WHEN** the pull request conversation is visible
- **AND** the user enters a general comment in the composer at the end of the conversation
- **THEN** Gitano MUST submit the comment through the selected GitHub access method
- **AND** Gitano MUST append the accepted comment to the visible conversation

### Requirement: GitHub review submission reports action state
The system SHALL report GitHub pull request review submission outcomes and access method routing using the existing workspace feedback pattern.

#### Scenario: Review submission succeeds
- **WHEN** GitHub accepts an approve, request changes, or comment-only review submission
- **THEN** Gitano MUST show a compact success message
- **AND** Gitano MUST refresh the affected pull request data
- **AND** Gitano MUST refresh the pending pull request count for the repository

#### Scenario: Selected access method is unavailable
- **WHEN** the selected GitHub access method is unavailable
- **AND** the user attempts a GitHub PR action
- **THEN** Gitano MUST block the action before submitting data
- **AND** Gitano MUST show the access method problem and the required user action

#### Scenario: Operation succeeds through fallback
- **WHEN** a GitHub PR operation succeeds through automatic fallback
- **THEN** Gitano MUST show the normal success state
- **AND** detailed diagnostics MUST identify that GitHub CLI handled the operation

#### Scenario: Review submission fails
- **WHEN** GitHub rejects an approve, request changes, or comment-only review submission
- **THEN** Gitano MUST show a compact failure message
- **AND** detailed GitHub error information MUST be available in the action log
- **AND** Gitano MUST NOT clear local draft review comments that were not submitted

### Requirement: Pull request review submission uses explicit review decisions
The system SHALL require users to choose the final review event before submitting a pull request review.

#### Scenario: User finishes a pull request review
- **WHEN** the user finishes a pull request review
- **THEN** Gitano MUST show an anchored finish-review dropdown with comment, approve, and request-changes decisions
- **AND** the comment decision MUST submit pending review feedback without approving or requesting changes
- **AND** the approve decision MUST submit an approve review event
- **AND** the request-changes decision MUST submit a request-changes review event with a non-empty summary body

#### Scenario: Pull request was authored by the current GitHub account
- **WHEN** the current GitHub account matches the pull request author
- **THEN** Gitano MUST disable approve and request-changes review decisions
- **AND** Gitano MUST keep comment-only review submission available
- **AND** Gitano MUST keep merge available because GitHub controls merge eligibility separately

#### Scenario: User submits pending review comments
- **WHEN** GitHub accepts pending pull request review comments
- **THEN** Gitano MUST refresh pull request review comments from the selected access method
- **AND** the newly submitted comments MUST remain visible in the review screen

### Requirement: Pull request merge actions share one merge method flow
The system SHALL present the same merge method options and confirmation behavior wherever a pull request can be merged.

#### Scenario: User merges from pull request review mode
- **WHEN** the user opens a pull request review screen
- **THEN** Gitano MUST show the pull request merge dropdown when repository merge methods are available
- **AND** selecting merge, squash, or rebase MUST open the same method-specific confirmation used by the pull request list
- **AND** submitting the confirmation MUST merge the pull request through the selected GitHub access method

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
