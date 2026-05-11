## MODIFIED Requirements

### Requirement: Repo workspace toolbar is simplified and right-aligned
The repo workspace SHALL present a simplified action toolbar that prioritizes the main Git workflow and aligns actions consistently with the commit workspace.

#### Scenario: Toolbar actions are rendered
- **WHEN** the repo workspace toolbar is shown
- **THEN** repository and branch selectors MUST remain on the left side of the toolbar
- **THEN** the repository and branch selector region MUST use the same live width as the left workspace sidebar pane
- **THEN** the remaining workspace actions MUST be grouped and aligned to the right side of the toolbar
- **THEN** the toolbar MUST NOT show `Undo`
- **THEN** the toolbar MUST NOT show `Redo`
