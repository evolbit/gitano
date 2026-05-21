## Purpose

Define Workspaces panel row selection and activation behavior for Git worktrees.

## Requirements

### Requirement: Worktree rows activate on double-click
The system SHALL switch the active repository tab to a worktree only when the user explicitly activates that worktree from the Workspaces panel.

#### Scenario: User single-clicks a worktree row
- **WHEN** the user single-clicks a worktree row in the Workspaces panel
- **THEN** the system MUST NOT switch the active repository tab to that worktree
- **THEN** the Workspaces panel MUST mark that row as the panel-local selected row using the same blue selected-row treatment as the branch panel
- **THEN** the previously selected worktree row MUST no longer show the blue selected-row treatment

#### Scenario: User double-clicks a worktree row
- **WHEN** the user double-clicks a non-current worktree row in the Workspaces panel
- **THEN** the Workspaces panel MUST mark that row as the panel-local selected row
- **THEN** the system MUST switch the active repository tab to that worktree
- **THEN** the system MUST clear the selected commit for the tab
- **THEN** the system MUST add the worktree path to recent repositories

### Requirement: Worktree row menu exposes explicit activation
The system SHALL expose an explicit worktree activation action in each Workspaces panel row context menu.

#### Scenario: User opens a non-current worktree row menu
- **WHEN** the user opens the three-dot menu for a non-current worktree row
- **THEN** the menu MUST show `Use Worktree`
- **THEN** the Workspaces panel MUST mark that row as the panel-local selected row
- **THEN** activating `Use Worktree` MUST switch the active repository tab to that worktree
- **THEN** activating `Use Worktree` MUST close the menu

#### Scenario: User opens the current worktree row menu
- **WHEN** the user opens the three-dot menu for the current worktree row
- **THEN** the menu MUST show `Use Worktree` in a disabled state
- **THEN** activating the disabled action MUST NOT switch tabs

#### Scenario: User opens any worktree row menu
- **WHEN** the user opens a worktree row menu
- **THEN** existing delete actions MUST remain available or disabled according to their current deletion rules
