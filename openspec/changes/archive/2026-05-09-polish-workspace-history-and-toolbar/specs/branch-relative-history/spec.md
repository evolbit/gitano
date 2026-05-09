## MODIFIED Requirements

### Requirement: Users can switch branch history view modes
The system SHALL let users choose how branch-relative history is rendered.

#### Scenario: View mode control is shown
- **WHEN** the commit table is rendered for a selected branch
- **THEN** the top controls MUST include a history mode selector
- **THEN** the selector MUST provide `Git log` and `First parent` options

#### Scenario: View mode changes
- **WHEN** the user changes the history mode to `First parent`
- **THEN** the frontend MUST reload branch history from the backend using the selected branch tip
- **THEN** the backend MUST follow only the first-parent ancestry of that branch tip
- **THEN** the commit list pagination MUST reset before rendering the updated history

#### Scenario: Git-log history is requested
- **WHEN** the user changes the history mode to `Git log`
- **THEN** the frontend MUST reload branch history from the backend using the selected branch tip
- **THEN** the backend MUST match `git log <selected-branch>` traversal semantics
- **THEN** the commit list pagination MUST reset before rendering the updated history

### Requirement: Commit table controls are simplified for branch history
The system SHALL simplify the commit table top controls to emphasize branch-history exploration.

#### Scenario: Commit table controls are rendered
- **WHEN** the commit table top bar is shown
- **THEN** it MUST keep the search box
- **THEN** it MUST include the history mode selector
- **THEN** it MUST NOT show the `Filtros` button
- **THEN** it MUST NOT show the `Añadir manualmente` button

#### Scenario: Commit selection is toggled off
- **WHEN** a commit row is already selected and the user clicks the same row again
- **THEN** the commit list MUST clear the selected row
- **THEN** the commit detail view MUST be hidden
- **THEN** the right-side detail panel MUST be collapsed

#### Scenario: Commit selection is dismissed with escape
- **WHEN** a commit row is selected and the user presses `Esc`
- **THEN** the commit list MUST clear the selected row
- **THEN** the commit detail view MUST be hidden
- **THEN** the right-side detail panel MUST be collapsed
