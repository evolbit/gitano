## ADDED Requirements

### Requirement: Branch comparison supports pull request review mode
The system SHALL allow the branch comparison review surface to run in a pull request review mode backed by GitHub pull request context.

#### Scenario: Pull request review opens
- **WHEN** a user opens `Review` for a GitHub pull request
- **THEN** Gitano MUST open the branch comparison review surface in pull request review mode
- **AND** the comparison MUST use the pull request base ref as the target side
- **AND** the comparison MUST use the pull request head ref as the source side
- **AND** opening the review MUST NOT change the user's checked-out branch

#### Scenario: Pull request refs are unavailable locally
- **WHEN** a user opens a GitHub pull request review
- **AND** the required base or head refs are not available locally
- **THEN** Gitano MUST prepare the required refs before loading the comparison
- **AND** Gitano MUST show a recoverable error if the refs cannot be prepared

#### Scenario: Pull request review header is rendered
- **WHEN** the branch comparison review surface is in pull request review mode
- **THEN** the header MUST identify the pull request being reviewed
- **AND** the header MUST expose `Analyze`, `Review`, and `Comments` actions
- **AND** the header MUST NOT require the user to manually choose equivalent branch endpoints before review can begin

### Requirement: Pull request review mode loads comments side panel
The system SHALL provide a comments side panel in pull request review mode.

#### Scenario: User opens Comments
- **WHEN** the user activates `Comments` in pull request review mode
- **THEN** Gitano MUST open a side panel in the review surface
- **AND** the panel MUST load pull request conversation and review comments for the selected pull request

#### Scenario: Comments load successfully
- **WHEN** GitHub pull request comments load successfully
- **THEN** the comments side panel MUST show existing comments with author, body, timestamp, and file or line context when available
- **AND** inline review comments that match visible diff anchors MUST be associated with the corresponding file or line
- **AND** file-level review comments MUST be associated with the changed file header when possible
- **AND** review replies MUST be rendered as replies nested under their parent review comment

#### Scenario: User comments on a changed file
- **WHEN** the branch comparison review surface is in pull request review mode
- **THEN** each selected changed file MUST expose a file-level comment control before the file hunks
- **AND** created file-level comment threads MUST be collapsed by default

#### Scenario: User edits an existing review comment
- **WHEN** a loaded GitHub review comment is visible in the pull request review surface
- **THEN** Gitano MUST allow the user to edit that comment from the review thread
- **AND** Gitano MUST keep the edited body as a local draft review change
- **AND** Gitano MUST NOT persist the edited body through GitHub until the user submits review comments

#### Scenario: User resolves a review thread locally
- **WHEN** a user resolves a visible review thread in the pull request review surface
- **THEN** Gitano MUST persist the resolved state through GitHub when the thread has GitHub review thread metadata
- **AND** Gitano MUST collapse the thread
- **AND** Gitano MUST show a `Resolved` tag in the thread header
- **AND** Gitano MUST expose a `Reopen conversation` action when the resolved thread is expanded
- **AND** Gitano MUST report GitHub resolve or reopen failures through the global action notice

#### Scenario: Comments fail to load
- **WHEN** GitHub pull request comments fail to load
- **THEN** the comments side panel MUST show a concise failure state
- **AND** detailed failure information MUST be available without closing the review surface

### Requirement: Pull request review comments can be submitted from draft threads
The system SHALL allow draft review threads created in pull request review mode to be submitted as GitHub pull request review comments.

#### Scenario: User submits draft comments as a review
- **WHEN** the user has draft review comments in pull request review mode
- **AND** the user submits a comment-only review
- **THEN** Gitano MUST translate each valid draft thread anchor into a GitHub review comment
- **AND** Gitano MUST submit the comments as a GitHub `COMMENT` review
- **AND** Gitano MUST submit file-level draft comments using GitHub file-level review comment semantics
- **AND** Gitano MUST submit draft replies to existing review comments using GitHub reply semantics instead of creating a new line comment
- **AND** Gitano MUST persist pending edits to existing GitHub review comments as part of the same submit action

#### Scenario: Draft comment anchor is invalid
- **WHEN** a draft review comment cannot be mapped to the current GitHub pull request diff
- **THEN** Gitano MUST prevent submission of that invalid comment
- **AND** Gitano MUST explain which comment cannot be submitted
- **AND** valid unsent draft comments MUST remain available for correction or retry

#### Scenario: Pull request review surface closes
- **WHEN** the pull request review surface closes with unsubmitted draft comments
- **THEN** Gitano MUST discard the unsubmitted draft comments for that modal session
- **AND** Gitano MUST NOT submit them to GitHub automatically
