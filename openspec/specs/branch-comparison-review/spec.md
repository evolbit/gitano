## Purpose

Describe branch-to-branch comparison review behavior, including the branch context menu entry, modal file/diff presentation, branch target selection, and draft line comments.

## Requirements

### Requirement: Branch context menu opens branch comparison
The system SHALL expose branch comparison from branch context menus.

#### Scenario: User opens comparison from a branch
- **WHEN** the user opens the context menu for a branch node
- **THEN** the menu MUST include an enabled action labeled `Compare to...`
- **AND** the label MUST NOT append a target branch name

#### Scenario: User selects compare action
- **WHEN** the user clicks `Compare to...` for a branch node
- **THEN** the system MUST open a branch comparison modal
- **AND** the clicked branch MUST be used as the head/source branch

#### Scenario: User opens context menu for a branch group
- **WHEN** the user opens the context menu for a branch group node
- **THEN** branch comparison MUST NOT start for the group itself

### Requirement: Branch comparison uses selectable base branch
The system SHALL let the user choose the base/target branch inside the comparison modal.

#### Scenario: Modal opens with current branch available
- **WHEN** the comparison modal opens
- **AND** the current checked-out branch exists in the available branches
- **AND** the current checked-out branch is different from the head/source branch
- **THEN** the current checked-out branch MUST be selected as the base/target branch

#### Scenario: Modal opens without current branch as valid target
- **WHEN** the comparison modal opens
- **AND** the current checked-out branch cannot be used as the base/target branch
- **THEN** the system MUST select another available branch that is different from the head/source branch

#### Scenario: User changes base branch
- **WHEN** the user chooses a different base/target branch
- **THEN** the changed file list MUST reload for the new comparison
- **AND** the selected file diff MUST update to match the new comparison

### Requirement: Branch target dropdown is searchable and virtualized
The system SHALL present a performant branch target dropdown for repositories with many branches.

#### Scenario: User opens branch target dropdown
- **WHEN** the user opens the base/target branch dropdown
- **THEN** the dropdown MUST show a search input
- **AND** the dropdown MUST group results into `Local` and `Remote` sections
- **AND** the head/source branch MUST be excluded from selectable results

#### Scenario: User searches branches
- **WHEN** the user types in the branch target search input
- **THEN** both local and remote branch results MUST be filtered by the search text
- **AND** sections with no matching branches MUST be hidden

#### Scenario: Repository has hundreds of branches
- **WHEN** the branch target dropdown contains hundreds of matching branch rows
- **THEN** the dropdown MUST render results through a virtualized list
- **AND** typing in the search input MUST remain responsive

### Requirement: Branch comparison uses direct branch diff
The system SHALL compare branches directly between the selected base/target branch tip and head/source branch tip.

#### Scenario: Comparison data is loaded
- **WHEN** the modal loads comparison data for a base/target branch and head/source branch
- **THEN** the diff MUST represent changes from the selected base/target branch tip to the head/source branch tip
- **AND** the result MUST show files changed between those branch tips

#### Scenario: Changed files are shown
- **WHEN** comparison data loads successfully
- **THEN** the modal MUST show the files changed between the selected base/target branch and head/source branch
- **AND** each file row MUST include its status and line change counts when available

#### Scenario: Comparison has no changed files
- **WHEN** the selected base/target branch and head/source branch have no changed files under direct branch comparison
- **THEN** the modal MUST show an empty state instead of a stale file list or stale diff

### Requirement: Branch comparison modal presents file list and diff viewer
The system SHALL present branch comparison in a modal with file navigation and a diff viewer.

#### Scenario: User selects a changed file
- **WHEN** the user selects a file from the changed file list
- **THEN** the right side of the modal MUST show that file's diff for the active branch comparison

#### Scenario: User switches diff display mode
- **WHEN** the user switches between `Unified` and `Split` display modes
- **THEN** the selected file MUST remain selected
- **AND** the visible diff MUST continue to represent the same active branch comparison

#### Scenario: User closes modal
- **WHEN** the user closes the branch comparison modal
- **THEN** the modal MUST be removed from view
- **AND** branch list selection and checkout state MUST NOT change as a side effect

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

### Requirement: Branch comparison supports local AI analysis
The system SHALL expose premium local AI branch and PR-style analysis from the branch comparison review surface.

#### Scenario: User opens branch comparison
- **WHEN** the branch comparison modal is open with a selected base branch and source branch
- **THEN** the modal MUST offer a local AI analysis action for the active comparison

#### Scenario: User starts branch analysis
- **WHEN** the user activates local AI analysis for the active branch comparison
- **THEN** the system MUST run branch analysis using the active base branch, source branch, and comparison mode
- **AND** the modal MUST show progress while local analysis is running

#### Scenario: Branch analysis succeeds
- **WHEN** local AI branch analysis completes
- **THEN** the modal MUST show a structured summary, risk assessment, changed-area overview, and findings
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: User changes comparison inputs
- **WHEN** the user changes the base branch or source branch for the comparison
- **THEN** the local AI analysis action MUST use a new Git input digest
- **AND** stale analysis for the previous comparison MUST NOT be shown as current analysis

#### Scenario: Local AI setup is required
- **WHEN** the selected model is not ready for branch analysis
- **THEN** the system MUST route the user through local AI setup before running analysis
