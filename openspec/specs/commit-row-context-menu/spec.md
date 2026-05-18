## Purpose

Define commit-row context menu behavior, including target scoping, grouped actions, comparison modals, creation/apply flows, remote commit links, and branch-menu cleanup for commit-only placeholders.

## Requirements

### Requirement: Commit rows expose a row-specific context menu
The system SHALL provide a context menu for commit table rows that is scoped to the commit row the user opened.

#### Scenario: User opens a commit row menu
- **WHEN** the user opens the context menu on a commit row
- **THEN** the menu MUST target that row's commit SHA
- **AND** the row MUST NOT become the selected commit just because the menu opened
- **AND** the active tab's selected commit MUST remain unchanged

#### Scenario: User opens a menu outside commit rows
- **WHEN** the user opens a context menu outside a commit row
- **THEN** the commit-row context menu MUST NOT open

#### Scenario: User dismisses the menu
- **WHEN** the user clicks outside the commit-row context menu or presses `Esc`
- **THEN** the context menu MUST close without changing repository state

### Requirement: Commit menu groups actions by intent
The system SHALL organize commit-row menu actions into stable logical groups.

#### Scenario: Menu actions are rendered
- **WHEN** a commit-row context menu is shown
- **THEN** it MUST include a `Commit` group with `Copy commit SHA`, `Copy commit message`, and `Copy patch`
- **THEN** it MUST include a `Compare` group with `Compare with parent...` and `Compare with working tree...`
- **THEN** it MUST include a `Create From Commit` group with `Create branch from commit...`, `Create tag at commit...`, and `Create worktree from commit...`
- **THEN** it MUST include an `Apply To Current Branch` group with `Cherry-pick commit...` and `Revert commit...`

#### Scenario: Rewrite history actions are not part of first pass
- **WHEN** a commit-row context menu is shown
- **THEN** it MUST NOT include `Delete commit`
- **THEN** it MUST NOT include `Undo last commit...`
- **THEN** it MUST NOT include `Drop commit...`
- **THEN** it MUST NOT include `Reset current branch to this commit...`

### Requirement: Commit copy actions use the targeted commit
The system SHALL copy commit data from the commit targeted by the context menu.

#### Scenario: User copies commit SHA
- **WHEN** the user activates `Copy commit SHA`
- **THEN** the full commit SHA for the targeted commit MUST be written to the clipboard
- **AND** the system MUST show a success notice

#### Scenario: User copies commit message
- **WHEN** the user activates `Copy commit message`
- **THEN** the commit message shown for the targeted commit MUST be written to the clipboard
- **AND** the system MUST show a success notice

#### Scenario: User copies patch
- **WHEN** the user activates `Copy patch`
- **THEN** the system MUST copy the Git patch for the targeted commit to the clipboard
- **AND** the patch MUST represent that commit against its first parent
- **AND** the system MUST show an error notice if the patch cannot be generated or copied

### Requirement: Commit compare actions open the correct review surface
The system SHALL use existing history and diff surfaces to show comparisons for the targeted commit.

#### Scenario: User compares with parent
- **WHEN** the user activates `Compare with parent...`
- **THEN** the system MUST open a commit comparison modal for the targeted commit
- **AND** the modal MUST compare the targeted commit against its first parent
- **AND** the modal MUST select the first changed file when one exists
- **AND** the active tab's selected commit MUST remain unchanged

#### Scenario: User compares an initial commit with parent
- **WHEN** the user activates `Compare with parent...` for an initial commit
- **THEN** the system MUST open a commit comparison modal comparing the commit against an empty tree
- **AND** added files from the initial commit MUST be visible as added content

#### Scenario: User compares with working tree
- **WHEN** the user activates `Compare with working tree...`
- **THEN** the system MUST open a commit comparison modal for the targeted commit
- **AND** the modal MUST compare the targeted commit tree against the repository's current working tree state
- **AND** the system MUST present changed files and file diffs without changing the selected branch or checked-out commit
- **AND** the system MUST show an empty state when there are no differences

### Requirement: Commit create actions use explicit forms
The system SHALL require explicit user input before creating refs or worktrees from a commit.

#### Scenario: User creates a branch from commit
- **WHEN** the user activates `Create branch from commit...`
- **THEN** the system MUST show a branch-name form using the targeted commit SHA as the base ref
- **AND** confirming the form MUST create the branch at the targeted commit
- **AND** repository refs and commit history MUST refresh after success

#### Scenario: User creates a tag from commit
- **WHEN** the user activates `Create tag at commit...`
- **THEN** the system MUST show a tag form using the targeted commit SHA as the tag target
- **AND** confirming the form MUST create the tag at the targeted commit
- **AND** repository refs MUST refresh after success

#### Scenario: User creates a worktree from commit
- **WHEN** the user activates `Create worktree from commit...`
- **THEN** the system MUST show a worktree form using the targeted commit SHA as the base ref
- **AND** the form MUST require a branch name and worktree path before creation
- **AND** confirming the form MUST create a new worktree from the targeted commit
- **AND** repository refs, worktrees, and commit history MUST refresh after success

### Requirement: Commit apply actions require confirmation
The system SHALL confirm commit apply operations before mutating the current branch.

#### Scenario: User cherry-picks a commit
- **WHEN** the user activates `Cherry-pick commit...`
- **THEN** the system MUST show a confirmation that names the targeted commit and the current branch
- **AND** confirming MUST cherry-pick the targeted commit onto the current branch
- **AND** repository refs, commits, and working changes MUST refresh after the command completes

#### Scenario: User reverts a commit
- **WHEN** the user activates `Revert commit...`
- **THEN** the system MUST show a confirmation that names the targeted commit and the current branch
- **AND** confirming MUST revert the targeted commit on the current branch
- **AND** repository refs, commits, and working changes MUST refresh after the command completes

#### Scenario: No current branch is available
- **WHEN** no current branch is selected or the repository is in detached HEAD
- **THEN** `Cherry-pick commit...` and `Revert commit...` MUST be disabled
- **AND** the disabled action title MUST explain that a current branch is required

#### Scenario: Apply command fails
- **WHEN** a cherry-pick or revert command fails
- **THEN** the system MUST show an error notice containing the backend error details
- **AND** repository refs, commits, and working changes MUST refresh so conflict or partial-operation state is visible

### Requirement: Remote commit actions appear only when resolvable
The system SHALL expose remote commit link actions only when the repository's origin URL can be resolved to a browser URL.

#### Scenario: Remote URL is resolvable
- **WHEN** a commit-row context menu is shown
- **AND** the repository has a resolvable origin URL
- **THEN** the menu MUST include a `Remote` group with `Open commit on remote` and `Copy commit URL`

#### Scenario: User opens commit on remote
- **WHEN** the user activates `Open commit on remote`
- **THEN** the system MUST open the browser URL for the targeted commit
- **AND** the URL MUST point to the commit view for the configured origin remote

#### Scenario: User copies commit URL
- **WHEN** the user activates `Copy commit URL`
- **THEN** the system MUST copy the browser URL for the targeted commit to the clipboard
- **AND** the system MUST show a success notice

#### Scenario: Remote URL is unavailable
- **WHEN** the repository does not have a resolvable origin URL
- **THEN** the commit-row context menu MUST hide the `Remote` group

### Requirement: Branch context menu excludes commit-only placeholders
The system SHALL remove commit-only placeholder actions from branch context menus.

#### Scenario: User opens a branch context menu
- **WHEN** the user opens the context menu for a branch node
- **THEN** the menu MUST NOT include `Cherry pick commit`
- **THEN** the menu MUST NOT include `Reset ... to this commit`
- **THEN** the menu MUST NOT include `Revert commit`

#### Scenario: User opens a branch group context menu
- **WHEN** the user opens the context menu for a branch group node
- **THEN** the menu MUST NOT include `Cherry pick commit`
- **THEN** the menu MUST NOT include `Reset ... to this commit`
- **THEN** the menu MUST NOT include `Revert commit`

### Requirement: Commit context menu supports local AI commit analysis
The system SHALL expose premium local AI commit analysis from commit row context menus.

#### Scenario: User opens context menu for a commit
- **WHEN** the user opens the context menu for a commit row
- **THEN** the menu MUST include a local AI analysis action for that commit

#### Scenario: User selects local AI commit analysis
- **WHEN** the user activates the local AI analysis action for a commit
- **THEN** the system MUST run commit analysis for the targeted commit SHA
- **AND** the system MUST show progress while local analysis is running

#### Scenario: Commit analysis succeeds
- **WHEN** local AI commit analysis completes
- **THEN** the system MUST show the structured summary and findings for the targeted commit
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: Local AI setup is required
- **WHEN** the selected model is not ready for commit analysis
- **THEN** the system MUST route the user through local AI setup before running analysis
