## Purpose

Specify how Gitano creates and opens local repositories that do not yet have
commits, including the first-commit workflow and guarded commit-dependent
actions.

## Requirements

### Requirement: Users can create local repositories from the launchpad
The system SHALL let users initialize an existing local folder as a Git repository from the launchpad.

#### Scenario: User creates a repository in a non-repository folder
- **WHEN** the user chooses to create a new local repository
- **AND** the user selects a folder that is not already a Git repository
- **THEN** the system MUST initialize a non-bare Git repository in that folder
- **AND** the system MUST open a repository workspace for that path
- **AND** the system MUST add the path to recent repositories
- **AND** the repository MUST be treated as an unborn repository until the first commit is created

#### Scenario: User chooses an existing repository through the create flow
- **WHEN** the user chooses to create a new local repository
- **AND** the selected folder is already a valid Git repository
- **THEN** the system MUST open that repository without reinitializing repository data
- **AND** the system MUST add the path to recent repositories

#### Scenario: Repository creation is cancelled
- **WHEN** the user starts creating a new local repository
- **AND** cancels folder selection
- **THEN** the system MUST NOT initialize a repository
- **AND** the system MUST NOT add a path to recent repositories

### Requirement: Empty initialized repositories are valid local repositories
The system SHALL treat a Git repository with no commits as a valid local repository.

#### Scenario: User opens an unborn repository
- **WHEN** the user selects a folder that contains a valid initialized Git repository
- **AND** the repository has no commits yet
- **THEN** the system MUST accept the folder as a local repository
- **AND** the system MUST open a repository workspace for that path
- **AND** the system MUST add the path to recent repositories
- **AND** the system MUST NOT show an invalid-repository error solely because `HEAD` has no commit target

#### Scenario: User opens a non-repository folder
- **WHEN** the user selects a folder that is not a Git repository
- **THEN** the system MUST reject the folder as invalid
- **AND** the system MUST NOT add that path to recent repositories

#### Scenario: Launchpad displays an unborn recent repository
- **WHEN** a recent repository has no commits yet
- **THEN** the launchpad MUST display the repository as a valid row
- **AND** the row MUST indicate that the repository has no commits yet instead of displaying a generic error state

### Requirement: Repository state distinguishes unborn branch from invalid repository
The system SHALL expose repository state that distinguishes unborn branches from invalid repositories and normal repositories.

#### Scenario: Repository has an unborn symbolic branch
- **WHEN** repository state is loaded for a repository whose `HEAD` points to a branch that has no commit
- **THEN** the backend MUST report the repository as valid
- **AND** the backend MUST report the symbolic branch name when it can be resolved
- **AND** the backend MUST report that the repository has no commits

#### Scenario: Repository has a normal current branch
- **WHEN** repository state is loaded for a repository with a current branch and at least one commit
- **THEN** the backend MUST report the repository as valid
- **AND** the backend MUST report the current branch name
- **AND** the backend MUST report that the repository has commits

#### Scenario: Repository has detached HEAD
- **WHEN** repository state is loaded for a repository with detached `HEAD`
- **THEN** the backend MUST report the repository as valid
- **AND** the backend MUST represent the branch as detached or absent
- **AND** the backend MUST report that the repository has commits

### Requirement: Current branch resolution supports unborn repositories
The system SHALL resolve the active branch for unborn repositories without requiring a commit.

#### Scenario: Current branch is requested for unborn repository
- **WHEN** frontend code requests the current branch for an unborn repository
- **THEN** the system MUST return the unborn branch name when available
- **AND** the request MUST NOT fail solely because `repo.head()` has no commit target

#### Scenario: Current branch is unavailable
- **WHEN** the current branch cannot be resolved for a valid repository
- **THEN** the system MUST return structured state that lets the frontend distinguish that condition from an invalid repository

### Requirement: History surfaces render first-commit empty state
The system SHALL render history surfaces for unborn repositories without backend errors.

#### Scenario: Commit history loads for unborn repository
- **WHEN** the commit history is requested for an unborn repository
- **THEN** the backend MUST return an empty commit page
- **AND** the frontend MUST render a first-commit empty state
- **AND** the frontend MUST NOT render stale commits from another repository

#### Scenario: Commit-dependent context actions are unavailable
- **WHEN** a repository has no commits yet
- **THEN** commit context actions such as amend, tag from commit, create branch from commit, cherry-pick, revert, and compare MUST NOT be offered as executable actions

### Requirement: Working changes support first-commit workflow
The system SHALL allow users to stage files and create the first commit in an unborn repository.

#### Scenario: Untracked files exist in unborn repository
- **WHEN** an unborn repository contains untracked files
- **THEN** the working changes surface MUST list those files
- **AND** selecting a file MUST show its contents as additions

#### Scenario: Files are staged before first commit
- **WHEN** files are staged in an unborn repository
- **THEN** staged diff state MUST be computed against the empty tree or equivalent no-commit baseline
- **AND** staged files MUST remain visible as selected or staged in the working changes surface

#### Scenario: User creates first commit
- **WHEN** an unborn repository has staged changes
- **AND** the user commits with a non-empty message
- **THEN** the system MUST create the first commit
- **AND** the repository MUST transition to normal committed state without requiring the user to reopen it

### Requirement: Commit-dependent Git actions are guarded while repository is unborn
The system SHALL prevent actions that require an existing commit from failing with raw `HEAD` errors in unborn repositories.

#### Scenario: User views toolbar actions in unborn repository
- **WHEN** the active repository has no commits yet
- **THEN** toolbar actions that require an existing commit or upstream branch state MUST be disabled or guarded
- **AND** visible disabled actions MUST explain that the repository needs an initial commit first

#### Scenario: User attempts unsupported Git action through another entry point
- **WHEN** the user reaches a Git action that requires an existing commit while the repository is unborn
- **THEN** the system MUST prevent the action or return a clear domain error
- **AND** the user-facing message MUST NOT expose a raw `HEAD` resolution failure

### Requirement: Repository refresh transitions from unborn to normal state
The system SHALL refresh repository surfaces when an unborn repository receives its first commit.

#### Scenario: First commit succeeds
- **WHEN** the first commit is created in an unborn repository
- **THEN** the system MUST refresh repository state
- **AND** the system MUST refresh refs and commit history
- **AND** commit-dependent actions that are now valid MUST become available without reopening the repository

#### Scenario: First commit occurs externally
- **WHEN** a watched unborn repository receives its first commit outside Gitano
- **THEN** repository-change handling MUST refresh repository state
- **AND** the workspace MUST transition from first-commit empty states to normal committed-repository views
