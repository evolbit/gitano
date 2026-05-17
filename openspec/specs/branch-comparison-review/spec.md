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
The system SHALL support draft-only line comments in the branch comparison modal.

#### Scenario: User adds a line comment
- **WHEN** the user starts a comment on a rendered diff line
- **AND** the user saves non-empty comment text
- **THEN** the system MUST show the draft comment attached to that line

#### Scenario: User edits a draft comment
- **WHEN** the user edits an existing draft comment
- **AND** the user saves non-empty updated text
- **THEN** the system MUST update the visible draft comment text

#### Scenario: User deletes a draft comment
- **WHEN** the user deletes an existing draft comment
- **THEN** the system MUST remove that draft comment from the modal

#### Scenario: User switches display mode with comments
- **WHEN** the user switches between `Unified` and `Split` display modes
- **THEN** draft comments MUST remain attached to their original diff lines

#### Scenario: User changes file with comments
- **WHEN** the user selects another file and later returns to a previously commented file
- **THEN** draft comments for the active branch comparison MUST still be visible for that file

#### Scenario: User closes modal with comments
- **WHEN** the user closes the branch comparison modal
- **THEN** all draft comments created in that modal session MUST be discarded
- **AND** reopening the modal MUST NOT restore those discarded draft comments
