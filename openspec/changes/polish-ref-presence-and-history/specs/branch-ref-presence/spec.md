## ADDED Requirements

### Requirement: Branches panel presents unified local and origin branch state
The system SHALL present local and origin branches in one unified branch tree with explicit metadata and divergence state for each logical branch name.

#### Scenario: Branch exists locally and on origin
- **WHEN** a branch name exists as a local branch and has a matching `origin` branch counterpart
- **THEN** the branches panel MUST render one row for that logical branch name

#### Scenario: Branch exists only locally
- **WHEN** a branch name exists locally and no `origin` counterpart is known
- **THEN** the branches panel MUST render one row for that logical branch name

#### Scenario: Branch exists only on origin
- **WHEN** a branch name exists under `origin` and no local branch counterpart is known
- **THEN** the branches panel MUST render one row for that logical branch name

#### Scenario: Branch refs are still loading
- **WHEN** branch ref data has not finished loading for the current repository
- **THEN** the branches panel MUST keep any cached rows visible without rendering stale presence indicators

### Requirement: Branch rows show local and origin divergence counts
The system SHALL show compact ahead and behind counts for branch rows whose local and origin counterparts can be compared.

#### Scenario: Origin has commits missing locally
- **WHEN** a branch row has both local and origin refs
- **AND** the origin ref has commits that are not reachable from the local ref
- **THEN** the row MUST show the missing local count as `N↓` before the row actions menu

#### Scenario: Local has commits missing on origin
- **WHEN** a branch row has both local and origin refs
- **AND** the local ref has commits that are not reachable from the origin ref
- **THEN** the row MUST show the unpushed local count as `N↑` before the row actions menu

#### Scenario: Local and origin have diverged
- **WHEN** a branch row has both local-only and origin-only commits
- **THEN** the row MUST show both `N↑` and `N↓` counts before the row actions menu

#### Scenario: Branch is synchronized
- **WHEN** a branch row has both local and origin refs
- **AND** neither ref has commits missing from the other
- **THEN** the row MUST NOT show zero-count divergence badges

#### Scenario: Branch has no counterpart
- **WHEN** a branch row exists only locally or only on origin
- **THEN** the row MUST NOT show ahead or behind counts

### Requirement: Branch actions respect unified branch presence
The system SHALL derive branch row action availability from the selected row's local and origin presence instead of from a panel-wide local/remote mode.

#### Scenario: User opens menu for a local branch row
- **WHEN** the user opens the context menu for a row with a local branch ref
- **THEN** local branch actions such as checkout, rename, delete, worktree creation, and local branch operations MUST be available according to existing repository constraints

#### Scenario: User opens menu for an origin-only branch row
- **WHEN** the user opens the context menu for a row that exists only on origin
- **THEN** actions requiring a local branch MUST be disabled or omitted with a clear reason
- **THEN** actions that can create or compare from the origin ref MUST remain available when repository state allows them

#### Scenario: User runs remote action for a local branch row
- **WHEN** the user activates a pull, push, or set-upstream action for a row with a local branch ref
- **THEN** the system MUST run the existing origin-based remote branch action against the local branch name

#### Scenario: User compares a branch row
- **WHEN** the user compares a unified branch row with the current branch
- **THEN** the comparison MUST use the concrete ref represented by the selected row and existing comparison semantics
