## MODIFIED Requirements

### Requirement: Working-tree diff modal mirrors the committed-file modal layout
The system SHALL use the same two-pane modal pattern for working-tree files that it already uses for committed-file diff inspection.

#### Scenario: Working-tree diff modal is rendered
- **WHEN** a working-tree diff modal is shown
- **THEN** the left pane MUST show the changed working-tree file list using the shared changes explorer
- **THEN** the right pane MUST show the selected file diff and hunks
- **THEN** the modal MUST open with the user-selected file as the initial file

#### Scenario: User navigates between working-tree files in the modal
- **WHEN** the user selects another changed file from the modal file list
- **THEN** the right pane MUST update to show that file's working-tree diff
- **THEN** the modal MUST remain open while navigating between files

#### Scenario: User opens the modal context menu
- **WHEN** the user right-clicks within the modal changes pane
- **THEN** the context menu MUST include the full modal action list
- **THEN** `Flat View` and `Tree View` MUST be functional
- **THEN** the remaining listed actions MAY be present in a disabled state until implemented

#### Scenario: User views a deleted working-tree file
- **WHEN** the selected working-tree file has been deleted from disk but is still tracked by Git
- **THEN** the right pane MUST show deletion hunks for that file
- **THEN** the modal MUST NOT render the deleted file as `No changes.` when a deletion diff exists

#### Scenario: Modal opens with a file that is off-screen in the left pane
- **WHEN** the user opens the modal from a file whose left-pane row is not initially visible
- **THEN** the modal MUST reveal that selected file in the left pane without requiring manual scrolling
