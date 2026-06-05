## ADDED Requirements

### Requirement: Diff rows highlight inline changed text
The system SHALL emphasize changed text ranges inside comparable deleted and added diff lines while preserving existing row-level add/delete coloring.

#### Scenario: Comparable unified lines are rendered
- **WHEN** a unified diff hunk contains a deleted line and an added line that can be paired within the same changed block
- **THEN** the deleted line MUST show darker red emphasis over the text range that differs from the added line
- **AND** the added line MUST show darker green emphasis over the text range that differs from the deleted line
- **AND** the line-number gutters and source wrapping behavior MUST remain unchanged

#### Scenario: Comparable split lines are rendered
- **WHEN** a split diff hunk pairs a deleted line with an added line in the same visual row
- **THEN** the old-side cell MUST show darker red emphasis over the changed text range
- **AND** the new-side cell MUST show darker green emphasis over the changed text range
- **AND** staging gutters and review-line anchors MUST remain tied to the same logical diff lines

#### Scenario: Changed line has no comparable counterpart
- **WHEN** an added or deleted diff line has no paired counterpart in its changed block
- **THEN** the line MUST keep the existing whole-row add/delete tone
- **AND** the system MUST NOT add inline changed-text emphasis to that unmatched line
