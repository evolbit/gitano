## ADDED Requirements

### Requirement: Toolbar stash actions execute repository stash workflows
The system SHALL provide actionable toolbar controls for creating a full working-tree stash and popping the latest stash entry for the active repository.

#### Scenario: User clicks toolbar stash
- **WHEN** the user activates the toolbar `Stash` action
- **THEN** the system MUST create a stash from all working-tree changes for the active repository
- **THEN** the system MUST include untracked files in that stash
- **THEN** the stash message MUST use the format `WIP-[branch-name]` based on the active branch

#### Scenario: User clicks toolbar pop
- **WHEN** the user activates the toolbar `Pop` action
- **THEN** the system MUST pop the most recent stash entry for the active repository

### Requirement: Current changes can create a stash from selected files
The system SHALL allow the current changes commit action menu to create a stash from the files and folders currently selected in the current changes pane.

#### Scenario: User chooses stash from the current changes commit action menu
- **WHEN** the user opens the current changes commit action menu and chooses `Stash`
- **THEN** the system MUST create a stash containing the currently selected files and folders from the current changes pane
- **THEN** the operation MUST NOT require a commit message input

#### Scenario: No files are selected for stash creation
- **WHEN** the user opens the current changes commit action menu and there are no selected files or folders
- **THEN** the `Stash` action MUST be disabled

### Requirement: Stashes pane lists stash entries and their files
The system SHALL provide a dedicated left-pane stashes section with a stash list, a resizable file list for the selected stash, and a footer action area.

#### Scenario: User opens the stashes section
- **WHEN** the user switches the left pane to `Stashes`
- **THEN** the pane MUST show a top list of stash entries
- **THEN** the pane MUST show a bottom list of files for the selected stash
- **THEN** the two lists MUST be separated by a resizer
- **THEN** the pane footer MUST expose an `Apply` action for the selected stash files

#### Scenario: Repository has no stashes
- **WHEN** the user opens the stashes section and the active repository has no stash entries
- **THEN** the pane MUST show an empty state for the stash list
- **THEN** the file list and `Apply` action MUST be disabled or hidden

### Requirement: Stash file selection defaults to all files
The system SHALL default stash-file selection to all files in the selected stash and provide explicit controls to select or unselect the full stash file list.

#### Scenario: User selects a stash entry
- **WHEN** the user selects a stash entry in the stash list
- **THEN** all files in that stash MUST be selected by default

#### Scenario: User changes file selection in the selected stash
- **WHEN** the user uses `Select All` or `Unselect All` in the stash file list
- **THEN** the system MUST update the selected files for the current stash accordingly

#### Scenario: No stash files are selected
- **WHEN** the selected stash file list contains no checked files
- **THEN** the footer `Apply` action MUST be disabled

### Requirement: Stash file application is scoped to selected files
The system SHALL allow the selected files of the currently selected stash entry to be applied without removing the stash entry.

#### Scenario: User applies selected stash files
- **WHEN** the user activates the footer `Apply` action for a selected stash entry
- **THEN** the system MUST apply only the checked files from that stash entry to the working tree
- **THEN** the stash entry MUST remain in the stash list after the operation

### Requirement: Stash entry row actions remain stash-scoped
The system SHALL expose stash-entry actions through a hover-only row menu on each stash entry.

#### Scenario: User hovers a stash row
- **WHEN** the pointer hovers a stash entry row
- **THEN** the row MUST reveal a three-dot actions button

#### Scenario: User opens the stash row menu
- **WHEN** the user activates the three-dot button on a stash entry row
- **THEN** the menu MUST show `Apply Stash`
- **THEN** the menu MUST show `Pop Stash`
- **THEN** the menu MUST show `Delete Stash`
- **THEN** the menu MUST show `Edit Stash Message`

### Requirement: Stash row actions operate on the full stash entry
The system SHALL treat stash row menu actions other than footer `Apply` as whole-entry operations.

#### Scenario: User applies a stash entry from the row menu
- **WHEN** the user activates `Apply Stash` from a stash row menu
- **THEN** the system MUST apply the full stash entry
- **THEN** the stash entry MUST remain in the stash list after the operation

#### Scenario: User pops a stash entry from the row menu
- **WHEN** the user activates `Pop Stash` from a stash row menu
- **THEN** the system MUST apply the full stash entry
- **THEN** the system MUST remove that stash entry after a successful pop

#### Scenario: User deletes a stash entry from the row menu
- **WHEN** the user activates `Delete Stash` from a stash row menu
- **THEN** the system MUST remove that stash entry without applying its changes

### Requirement: Stash messages can be edited inline from the stash list
The system SHALL allow stash message editing inline on the selected stash row.

#### Scenario: User enters stash message edit mode
- **WHEN** the user activates `Edit Stash Message` from a stash row menu
- **THEN** only that stash row MUST switch into inline message editing mode

#### Scenario: User saves an edited stash message
- **WHEN** the user confirms the edited message
- **THEN** the system MUST persist the new message for that stash entry
- **THEN** the stash list MUST refresh to show the updated message
