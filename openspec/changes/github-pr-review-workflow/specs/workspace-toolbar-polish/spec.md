## ADDED Requirements

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
