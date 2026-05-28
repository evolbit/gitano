## MODIFIED Requirements

### Requirement: GitHub pull requests are listed for the active repository
The system SHALL list GitHub pull requests for the active repository using the selected GitHub access method.

#### Scenario: GitHub CLI access method is selected
- **WHEN** the active repository remote resolves to a GitHub repository
- **AND** the GitHub access method is GitHub CLI
- **AND** GitHub CLI is ready
- **AND** the user opens the pull request modal
- **THEN** Gitano MUST load open pull requests through `gh`
- **AND** the modal MUST present the same pull request row data shape used by OAuth-backed loading

#### Scenario: Automatic fallback handles OAuth access policy failure
- **WHEN** the GitHub access method is automatic fallback
- **AND** OAuth-backed pull request loading fails because the OAuth app cannot access the organization repository
- **AND** GitHub CLI is ready
- **THEN** Gitano MUST retry the operation through GitHub CLI
- **AND** Gitano MUST avoid prompting the user to reconnect OAuth for that operation

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

### Requirement: GitHub review submission reports action state
The system SHALL report GitHub pull request review submission outcomes and access method routing using the existing workspace feedback pattern.

#### Scenario: Selected access method is unavailable
- **WHEN** the selected GitHub access method is unavailable
- **AND** the user attempts a GitHub PR action
- **THEN** Gitano MUST block the action before submitting data
- **AND** Gitano MUST show the access method problem and the required user action

#### Scenario: Operation succeeds through fallback
- **WHEN** a GitHub PR operation succeeds through automatic fallback
- **THEN** Gitano MUST show the normal success state
- **AND** detailed diagnostics MUST identify that GitHub CLI handled the operation

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
