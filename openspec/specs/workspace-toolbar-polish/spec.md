## Purpose

Define the repo workspace toolbar, selection-dismissal behavior, and workspace copy conventions for the main Git workflow surfaces.

## Requirements

### Requirement: Repo workspace toolbar is simplified and right-aligned
The repo workspace SHALL present a simplified action toolbar that prioritizes the main Git workflow and aligns actions consistently with the commit workspace.

#### Scenario: Toolbar actions are rendered
- **WHEN** the repo workspace toolbar is shown
- **THEN** repository and branch selectors MUST remain on the left side of the toolbar
- **THEN** the repository and branch selector region MUST use the same live width as the left workspace sidebar pane
- **THEN** the remaining workspace actions MUST be grouped and aligned to the right side of the toolbar
- **THEN** the toolbar MUST NOT show `Undo`
- **THEN** the toolbar MUST NOT show `Redo`

### Requirement: Workspace selection is toggleable
The repo workspace SHALL allow users to clear commit selection using either repeated row clicks or keyboard dismissal.

#### Scenario: User clicks the selected commit row again
- **WHEN** a commit row is already selected and the user clicks the same row again
- **THEN** the selected commit MUST be cleared
- **THEN** the commit detail view MUST be hidden
- **THEN** the right-side detail panel MUST be collapsed

#### Scenario: User presses escape while a commit is selected
- **WHEN** a commit row is selected and the user presses `Esc`
- **THEN** the selected commit MUST be cleared
- **THEN** the commit detail view MUST be hidden
- **THEN** the right-side detail panel MUST be collapsed

### Requirement: Workspace copy is shown in English
The repo workspace SHALL present visible user-facing copy in English on the main Git workflow surfaces covered by this change.

#### Scenario: Workspace labels and empty states are rendered
- **WHEN** the user views the repo workspace
- **THEN** visible labels, controls, and empty-state text on the touched workspace surfaces MUST be rendered in English

### Requirement: Repo toolbar exposes pull request entry point
The repo workspace toolbar SHALL expose a pull request entry point for the active repository tab.

#### Scenario: Toolbar actions are rendered for a repository
- **WHEN** the repo workspace toolbar is shown for an active repository
- **THEN** the toolbar MUST render a vertical divider after the existing Git action icons
- **AND** the toolbar MUST render a pull request button after that divider
- **AND** the pull request button MUST use GitHub-native pull request terminology

#### Scenario: Pending pull request count is available
- **WHEN** the active repository has a pending pull request count
- **THEN** the pull request button MUST show the count in parentheses
- **AND** the count MUST represent open pull requests visible to the connected GitHub account for that repository

#### Scenario: Pending pull request count is unavailable
- **WHEN** the active repository pending pull request count has not loaded or cannot be fetched
- **THEN** the pull request button MUST remain usable
- **AND** the button MUST avoid showing a stale count as freshly loaded data

#### Scenario: User opens pull requests from toolbar
- **WHEN** the user activates the pull request button
- **THEN** Gitano MUST open the pull request modal for the active repository tab
