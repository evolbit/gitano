## ADDED Requirements

### Requirement: Conflict-file selection replaces the right workspace with conflict resolution
The system SHALL replace the repository right workspace with a conflict resolution surface when the user opens a conflicted file from Current Changes.

#### Scenario: User opens a conflicted working-tree file
- **WHEN** the user opens a conflicted file from the Current Changes pane
- **THEN** the system MUST replace the full right workspace with a conflict resolution surface for that file
- **AND** the Current Changes pane MUST remain visible as the file navigator
- **AND** the previously selected commit MUST remain preserved as repository state even though the history workspace is no longer rendered

#### Scenario: User closes conflict resolution
- **WHEN** the user closes the conflict resolution surface
- **THEN** the system MUST restore the normal history workspace layout on the right side
- **AND** the selected conflicted path MUST be cleared unless another unresolved conflict is automatically selected

#### Scenario: User opens a normal working-tree file after conflict resolution
- **WHEN** the user selects a non-conflicted changed file from Current Changes
- **THEN** the system MUST open the normal working-tree inline diff viewer
- **AND** any conflict-specific editor state MUST NOT leak into the normal diff viewer
