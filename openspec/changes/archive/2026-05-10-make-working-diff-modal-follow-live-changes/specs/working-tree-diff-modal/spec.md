## MODIFIED Requirements

### Requirement: Working-tree diff modal follows live working changes while open
The system SHALL keep the working-tree diff modal synchronized with the same live working-changes source used by the current-changes sidebar.

#### Scenario: Working changes refresh while the modal is open
- **WHEN** the repository working changes are refreshed while a working-tree diff modal is open
- **THEN** the modal file list MUST update to reflect the refreshed working changes
- **THEN** the modal MUST continue showing the selected file if a file with the same path still exists in the refreshed changes

#### Scenario: New working-change file appears while the modal is open
- **WHEN** a new working-change file is detected while the working-tree diff modal is open
- **THEN** that file MUST appear in the modal file list without closing and reopening the modal
- **THEN** newly detected untracked files MUST be grouped the same way they are in the main current-changes sidebar

#### Scenario: Selected file disappears while the modal is open
- **WHEN** the currently selected working-tree file is no longer present in the refreshed working changes
- **THEN** the modal MUST close or clear the working-tree selection rather than keeping a stale selected file view

#### Scenario: Selected file still exists after refresh
- **WHEN** the currently selected working-tree file still exists after a working-changes refresh
- **THEN** the modal MUST preserve selection by file path
- **THEN** the right-pane diff MUST rebind to the refreshed file entry for that path
