# inline-pane-diff-workspace Specification

## Purpose
TBD - created by archiving change replace-modal-diff-with-inline-pane-diff. Update Purpose after archive.
## Requirements
### Requirement: Working-tree file selection replaces the entire right workspace
The system SHALL replace the entire repository right workspace with an inline diff viewer when the user opens a working-tree file from the current changes pane.

#### Scenario: User opens a working-tree file diff
- **WHEN** the user opens a changed working-tree file from the current changes pane
- **THEN** the system MUST replace the full right workspace with an inline diff viewer for that file
- **THEN** the current changes pane MUST remain visible as the file navigator
- **THEN** the previously selected commit MUST remain preserved as repository state even though the history workspace is no longer rendered

### Requirement: Commit-file selection replaces only the middle history pane
The system SHALL replace only the middle history pane with an inline diff viewer when the user opens a file from the commit changes pane.

#### Scenario: User opens a commit-file diff
- **WHEN** the user opens a file from the commit changes pane for the selected commit
- **THEN** the system MUST replace the middle history pane with an inline diff viewer for that file
- **THEN** the commit details pane MUST remain visible
- **THEN** the selected commit MUST remain unchanged

### Requirement: Inline diff viewers preserve shared diff interactions
The system SHALL provide the same core diff interactions in both inline hosts.

#### Scenario: User interacts with an inline diff viewer
- **WHEN** an inline diff viewer is open from either the working-tree or commit-changes flow
- **THEN** the viewer MUST expose an explicit close action
- **THEN** the user MUST be able to close it with `Esc`
- **THEN** the viewer MUST support switching between `Unified` and `Split` display modes

### Requirement: Closing inline diff viewers restores the correct pane host
The system SHALL restore the replaced pane structure when an inline diff viewer is closed.

#### Scenario: User closes a working-tree inline diff
- **WHEN** the user closes an inline working-tree diff viewer
- **THEN** the system MUST restore the normal history workspace layout on the right side

#### Scenario: User closes a commit-file inline diff
- **WHEN** the user closes an inline commit-file diff viewer
- **THEN** the system MUST restore the commit list in the middle history pane
- **THEN** the commit details pane MUST remain on the currently selected commit

