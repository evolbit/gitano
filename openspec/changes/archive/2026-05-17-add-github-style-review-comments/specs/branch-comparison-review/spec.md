## MODIFIED Requirements

### Requirement: Branch comparison supports draft line comments
The system SHALL support draft-only GitHub-style review threads in the branch comparison modal.

#### Scenario: User adds a line comment
- **WHEN** the user starts a comment on a rendered diff line
- **AND** the user saves non-empty Markdown text
- **THEN** the system MUST show a review thread attached to that line
- **AND** the thread MUST display the saved Markdown as a rendered comment body

#### Scenario: User composes with Markdown toolbar
- **WHEN** the user selects text in a comment composer
- **AND** the user activates a Markdown toolbar control
- **THEN** the selected text MUST be transformed into the corresponding Markdown syntax in the composer

#### Scenario: User previews a Markdown draft
- **WHEN** the user switches a composer from `Write` to `Preview`
- **THEN** the composer MUST render the current Markdown draft using GitHub-flavored Markdown support
- **AND** unsafe HTML MUST NOT execute

#### Scenario: User inserts emoji
- **WHEN** the user chooses an emoji from the composer emoji control
- **THEN** the emoji MUST be inserted into the Markdown draft at the current cursor or selection

#### Scenario: User replies to a review thread
- **WHEN** the user saves a non-empty reply in an existing line thread
- **THEN** the system MUST append the reply as a new comment in the same thread
- **AND** the thread MUST remain attached to the original diff line

#### Scenario: User edits a draft comment
- **WHEN** the user edits an existing draft comment
- **AND** the user saves non-empty updated Markdown text
- **THEN** the system MUST update the visible comment body
- **AND** the comment metadata MUST record an updated timestamp

#### Scenario: User deletes a draft comment
- **WHEN** the user deletes an existing draft comment
- **THEN** the system MUST remove that draft comment from the thread
- **AND** the system MUST remove the thread if no comments remain in it

#### Scenario: User resolves a review thread
- **WHEN** the user resolves an existing review thread
- **THEN** the system MUST mark the thread as resolved for the current modal session
- **AND** the user MUST be able to reopen the thread during the same modal session

#### Scenario: User switches display mode with comments
- **WHEN** the user switches between `Unified` and `Split` display modes
- **THEN** draft review threads MUST remain attached to their original diff lines
- **AND** split view threads MUST render in a row wide enough for the review thread content rather than inside only one side cell

#### Scenario: User changes file with comments
- **WHEN** the user selects another file and later returns to a previously commented file
- **THEN** draft review threads for the active branch comparison MUST still be visible for that file

#### Scenario: User closes modal with comments
- **WHEN** the user closes the branch comparison modal
- **THEN** all draft review threads created in that modal session MUST be discarded
- **AND** reopening the modal MUST NOT restore those discarded draft review threads

## ADDED Requirements

### Requirement: Branch comparison models review comment data for future persistence
The system SHALL model branch comparison review comments with future PR persistence in mind while keeping current data draft-only.

#### Scenario: Review thread is created
- **WHEN** a user creates a line comment thread
- **THEN** the thread model MUST include a stable thread id, comparison pair key, file path, diff line anchor, resolution state, comments, and attachment placeholders

#### Scenario: Review comment is created
- **WHEN** a user saves a comment or reply
- **THEN** the comment model MUST include a stable comment id, thread id, author metadata, Markdown body, created timestamp, updated timestamp, lifecycle state, and reactions collection

#### Scenario: Modal session ends
- **WHEN** the branch comparison modal closes
- **THEN** all review thread data MUST be discarded from memory
- **AND** no backend persistence MUST be attempted
