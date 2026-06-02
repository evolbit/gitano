## ADDED Requirements

### Requirement: Remote branch rows expose branch-focused actions
The system SHALL render remote branch context menu actions that focus on branch workflows and exclude commit-tip workflows.

#### Scenario: User opens a remote branch context menu
- **WHEN** the user opens the context menu for remote branch `origin/feature/login`
- **AND** the current checked-out branch is `main`
- **THEN** the menu MUST include `Checkout origin/feature/login`
- **THEN** the menu MUST include `Create worktree from origin/feature/login`
- **THEN** the menu MUST include `Create branch from origin/feature/login`
- **THEN** the menu MUST include `Merge origin/feature/login into main`
- **THEN** the menu MUST include `Rebase main onto origin/feature/login`
- **THEN** the menu MUST include branch comparison actions with explicit direction labels
- **THEN** the menu MUST include `Delete origin/feature/login...`
- **THEN** the menu MUST include copy actions for branch name and commit SHA

#### Scenario: Remote branch menu excludes commit-tip actions
- **WHEN** the user opens the context menu for a remote branch row
- **THEN** the menu MUST NOT include cherry-pick actions
- **THEN** the menu MUST NOT include create tag actions
- **THEN** the menu MUST NOT include reset actions

#### Scenario: Remote branch menu opens without a current branch
- **WHEN** the user opens the context menu for a remote branch row
- **AND** no current checked-out branch is available
- **THEN** checkout, create worktree, create branch, delete, and copy actions MUST remain available when their own prerequisites are satisfied
- **THEN** merge, rebase, and comparison actions MUST be disabled
- **THEN** disabled actions MUST explain that a current local branch is required

### Requirement: Remote branch checkout creates or switches to a local tracking branch
The system SHALL handle remote branch checkout by activating a local tracking branch instead of detaching `HEAD`.

#### Scenario: User checks out a remote-only branch from the menu
- **WHEN** the user activates `Checkout origin/feature/login`
- **AND** no local `feature/login` branch exists
- **THEN** the system MUST create a local `feature/login` branch from `origin/feature/login`
- **THEN** the local branch MUST track `origin/feature/login`
- **THEN** the system MUST check out `feature/login`
- **THEN** the branches panel selection and active repository tab MUST update to `feature/login`

#### Scenario: User checks out a remote branch that has a local counterpart
- **WHEN** the user activates `Checkout origin/feature/login`
- **AND** local `feature/login` already exists
- **THEN** the system MUST check out local `feature/login`
- **THEN** the system MUST NOT detach `HEAD` at `origin/feature/login`

#### Scenario: User double-clicks a remote branch row
- **WHEN** the user double-clicks remote branch row `origin/feature/login`
- **THEN** the system MUST run the same checkout behavior used by the remote branch menu checkout action

#### Scenario: User double-clicks a branch group
- **WHEN** the user double-clicks a branch group row
- **THEN** the system MUST NOT run checkout
- **THEN** the group expansion behavior MUST remain controlled by the existing group interaction

### Requirement: Remote branch merge and rebase target the current branch
The system SHALL expose remote branch merge and rebase actions that use the remote branch as the source/upstream and the current checked-out branch as the local target.

#### Scenario: User merges a remote branch into the current branch
- **WHEN** the current checked-out branch is `main`
- **AND** the user activates `Merge origin/feature/login into main`
- **THEN** the system MUST run a merge of `origin/feature/login` into `main`
- **THEN** success and failure feedback MUST use the shared git-action notice pattern
- **THEN** repository refs and commit history MUST refresh after the action completes

#### Scenario: User rebases the current branch onto a remote branch
- **WHEN** the current checked-out branch is `main`
- **AND** the user activates `Rebase main onto origin/feature/login`
- **THEN** the system MUST run a rebase of `main` onto `origin/feature/login`
- **THEN** success and failure feedback MUST use the shared git-action notice pattern
- **THEN** repository refs and commit history MUST refresh after the action completes

#### Scenario: Current branch is unavailable for remote operations
- **WHEN** no current checked-out local branch is available
- **THEN** remote merge and rebase actions MUST be disabled
- **THEN** activating disabled actions MUST NOT run Git commands

### Requirement: Remote branch deletion deletes the branch from origin
The system SHALL delete remote branches through an explicit remote delete flow.

#### Scenario: User requests remote branch deletion
- **WHEN** the user activates `Delete origin/feature/login...`
- **THEN** the system MUST show a confirmation dialog that names `origin/feature/login`
- **THEN** the dialog MUST explain that the branch will be deleted from `origin`
- **THEN** the system MUST NOT delete the remote branch until the user confirms

#### Scenario: User confirms remote branch deletion
- **WHEN** the user confirms deletion for `origin/feature/login`
- **THEN** the system MUST run a remote delete for branch `feature/login` on remote `origin`
- **THEN** repository refs and commit history MUST refresh after the action completes
- **THEN** success and failure feedback MUST use the shared git-action notice pattern

#### Scenario: User cancels remote branch deletion
- **WHEN** the user cancels the remote branch deletion confirmation
- **THEN** the system MUST NOT run a remote delete command

### Requirement: Remote branch menu shows matching pull request actions only when known
The system SHALL expose pull request actions for a remote branch only when Gitano can resolve a matching open pull request.

#### Scenario: Matching open pull request is known
- **WHEN** remote branch `origin/feature/login` has a matching open pull request
- **THEN** the menu MUST include actions to review the pull request, view the pull request on the provider, and copy the pull request link
- **THEN** the pull request labels MUST include the pull request number

#### Scenario: No matching open pull request is known
- **WHEN** remote branch `origin/feature/login` has no resolved matching open pull request
- **THEN** the menu MUST NOT render pull request action placeholders
- **THEN** other remote branch actions MUST remain available according to their prerequisites

### Requirement: Remote branch copy actions include provider links when available
The system SHALL provide copy actions for remote branch names, tip SHAs, and provider web links when the origin remote URL can be resolved.

#### Scenario: Origin web URL is available
- **WHEN** the user opens the context menu for `origin/feature/login`
- **AND** the origin remote URL can be converted to a provider web URL
- **THEN** the menu MUST include `Copy branch URL`
- **THEN** the menu MUST include `Copy commit URL on origin`

#### Scenario: Origin web URL is unavailable
- **WHEN** the user opens the context menu for `origin/feature/login`
- **AND** the origin remote URL is missing or cannot be converted to a provider web URL
- **THEN** the menu MUST NOT include `Copy branch URL`
- **THEN** the menu MUST NOT include `Copy commit URL on origin`

#### Scenario: User copies a remote branch provider URL
- **WHEN** the user activates `Copy branch URL`
- **THEN** the system MUST copy a provider URL that points to the selected branch
- **THEN** the system MUST show copy success or failure feedback

#### Scenario: User copies a remote branch tip commit provider URL
- **WHEN** the user activates `Copy commit URL on origin`
- **THEN** the system MUST resolve the selected remote branch tip commit
- **THEN** the system MUST copy a provider URL that points to that commit
- **THEN** the system MUST show copy success or failure feedback
