## Purpose

Define responsiveness expectations for editable diff selection in working-tree diffs.

## Requirements

### Requirement: Editable diff selection remains responsive for single-click interactions
The system SHALL keep editable diff line and block selection responsive when the user toggles a single line or block in working-tree diffs.

#### Scenario: User toggles one line in a large diff
- **WHEN** the user clicks a selectable line in a working-tree diff
- **THEN** the system MUST update the visible selected state immediately
- **THEN** the system MUST NOT require unrelated hunks in the same file to fully recompute their derived render structures solely because one line changed

#### Scenario: User toggles one block in a large diff
- **WHEN** the user clicks a block-selection gutter in a working-tree diff
- **THEN** the system MUST update the block selection immediately
- **THEN** the system MUST limit rerender work to the affected selection state instead of rebuilding the entire file view unnecessarily

### Requirement: Editable diff drag selection remains responsive
The system SHALL keep drag-based selection responsive across working-tree diff rows.

#### Scenario: User drags across multiple selectable lines
- **WHEN** the user drags across selectable lines in a working-tree diff
- **THEN** the visible selection state MUST keep up with the pointer without noticeable per-line lag
- **THEN** the system MUST avoid repeated full-file recomputation for each crossed line

### Requirement: Responsiveness optimization preserves current staging semantics
The system SHALL preserve current working-tree staging behavior while improving responsiveness.

#### Scenario: User selects lines and finishes the gesture
- **WHEN** the user completes a click or drag selection interaction
- **THEN** the system MUST continue to use the existing immediate Git index staging flow
- **THEN** the optimization MUST NOT change which lines or blocks become staged
