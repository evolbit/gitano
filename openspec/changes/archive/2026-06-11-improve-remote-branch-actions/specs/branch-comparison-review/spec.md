## ADDED Requirements

### Requirement: Remote branch rows can start branch comparisons
The system SHALL allow remote branch rows to be used as branch comparison endpoints from the branch context menu.

#### Scenario: User compares a remote branch against the current branch
- **WHEN** the user opens the context menu for remote branch `origin/feature/login`
- **AND** the current checked-out branch is `main`
- **THEN** the menu MUST include an enabled action labeled `Show changes in origin/feature/login against main...`
- **THEN** activating the action MUST open the branch comparison modal with `origin/feature/login` as the head/source branch and `main` as the base/target branch

#### Scenario: User compares the current branch against a remote branch
- **WHEN** the user opens the context menu for remote branch `origin/feature/login`
- **AND** the current checked-out branch is `main`
- **THEN** the menu MUST include an enabled action labeled `Show changes in main against origin/feature/login...`
- **THEN** activating the action MUST open the branch comparison modal with `main` as the head/source branch and `origin/feature/login` as the base/target branch

#### Scenario: Current branch is unavailable for remote comparison
- **WHEN** the user opens the context menu for a remote branch row
- **AND** no current checked-out branch is available
- **THEN** remote branch comparison actions MUST be disabled
- **THEN** activating disabled comparison actions MUST NOT open the branch comparison modal
