## MODIFIED Requirements

### Requirement: Changes explorer is shared between main workspace and working-tree modal
The system SHALL use the same changes explorer model in the main workspace changes pane and the working-tree diff modal.

#### Scenario: Same file is shown in both surfaces
- **WHEN** the user opens the working-tree diff modal from the main workspace changes pane
- **THEN** both surfaces MUST present the same tracked and untracked file structure
- **THEN** the difference between the surfaces MUST be limited to enabled controls rather than a different file presentation model

#### Scenario: Selected file is initially outside the visible area in flat mode
- **WHEN** the diff modal opens in `Flat View` and the selected file row is outside the visible portion of the left pane
- **THEN** the explorer MUST scroll the left pane so that selected file becomes visible

#### Scenario: Selected file is initially outside the visible area in tree mode
- **WHEN** the diff modal opens in `Tree View` and the selected file row is outside the visible portion of the left pane
- **THEN** the explorer MUST expand the selected file's ancestor folders
- **THEN** the explorer MUST scroll the left pane so that selected file becomes visible
