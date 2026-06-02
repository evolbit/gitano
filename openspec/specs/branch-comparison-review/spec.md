## Purpose

Describe branch-to-branch comparison review behavior, including directional branch context menu entries, editable comparison endpoints, modal file/diff presentation, branch endpoint selection, and draft line comments.

## Requirements

### Requirement: Branch context menu opens branch comparison
The system SHALL expose directional branch comparison from branch context menus.

#### Scenario: User opens comparison from a different current branch
- **WHEN** the user opens the context menu for a branch node
- **AND** a current checked-out branch is available
- **AND** the branch node is different from the current checked-out branch
- **THEN** the menu MUST include an enabled action labeled `Show changes in <selected branch> against <current branch>...`
- **AND** the menu MUST include an enabled action labeled `Show changes in <current branch> against <selected branch>...`
- **AND** each label MUST make the comparison direction explicit

#### Scenario: User selects selected-against-current action
- **WHEN** the user clicks `Show changes in <selected branch> against <current branch>...`
- **THEN** the system MUST open a branch comparison modal
- **AND** the selected branch MUST be used as the head/source branch
- **AND** the current checked-out branch MUST be used as the base/target branch

#### Scenario: User selects current-against-selected action
- **WHEN** the user clicks `Show changes in <current branch> against <selected branch>...`
- **THEN** the system MUST open a branch comparison modal
- **AND** the current checked-out branch MUST be used as the head/source branch
- **AND** the selected branch MUST be used as the base/target branch

#### Scenario: User opens comparison from current branch
- **WHEN** the user opens the context menu for the current checked-out branch
- **THEN** the menu MUST show both directional comparison actions disabled
- **AND** branch comparison MUST NOT start from either disabled action

#### Scenario: Current branch is unavailable
- **WHEN** the user opens the context menu for a branch node
- **AND** no current checked-out branch is available
- **THEN** the menu MUST show both directional comparison actions disabled
- **AND** branch comparison MUST NOT start from either disabled action

#### Scenario: User opens context menu for a branch group
- **WHEN** the user opens the context menu for a branch group node
- **THEN** branch comparison MUST NOT start for the group itself

### Requirement: Branch comparison uses selectable base branch
The system SHALL let the user choose both the head/source branch and the base/target branch inside the comparison modal.

#### Scenario: Modal opens with a complete comparison pair
- **WHEN** the comparison modal opens with a head/source branch and a base/target branch
- **THEN** the head/source branch selector MUST show the provided head/source branch
- **AND** the base/target branch selector MUST show the provided base/target branch
- **AND** the active comparison MUST use the provided pair

#### Scenario: Modal opens without complete selections
- **WHEN** the comparison modal opens without a head/source branch or without a base/target branch
- **THEN** the missing selector MUST show a branch selection placeholder
- **AND** the system MUST NOT load comparison files until both endpoints are selected

#### Scenario: User changes head/source branch
- **WHEN** the user chooses a different head/source branch
- **THEN** the changed file list MUST reload for the new comparison when the base/target branch is selected and different
- **AND** the selected file diff MUST update to match the new comparison

#### Scenario: User changes base/target branch
- **WHEN** the user chooses a different base/target branch
- **THEN** the changed file list MUST reload for the new comparison when the head/source branch is selected and different
- **AND** the selected file diff MUST update to match the new comparison

#### Scenario: User swaps comparison direction
- **WHEN** the user activates the swap control between the branch selectors
- **THEN** the previous head/source branch MUST become the base/target branch
- **AND** the previous base/target branch MUST become the head/source branch
- **AND** the changed file list and selected file diff MUST reload for the swapped comparison when both branches are selected and different

#### Scenario: User selects the same branch on both sides
- **WHEN** the head/source branch and base/target branch are the same branch
- **THEN** the system MUST clear stale changed files and stale selected file diff
- **AND** the system MUST show a no-changes empty state
- **AND** the system MUST NOT call branch comparison file or diff APIs

### Requirement: Branch target dropdown is searchable and virtualized
The system SHALL present reusable, performant branch dropdowns for selecting branch comparison endpoints.

#### Scenario: User opens a branch endpoint dropdown
- **WHEN** the user opens either branch endpoint dropdown
- **THEN** the dropdown MUST show a search input
- **AND** the dropdown MUST group results into `Local` and `Remote` sections
- **AND** the dropdown MUST allow selecting the same branch as the opposite endpoint

#### Scenario: User searches branches
- **WHEN** the user types in a branch endpoint search input
- **THEN** both local and remote branch results MUST be filtered by the search text
- **AND** sections with no matching branches MUST be hidden

#### Scenario: Repository has hundreds of branches
- **WHEN** the branch endpoint dropdown contains hundreds of matching branch rows
- **THEN** the dropdown MUST render results through a virtualized list
- **AND** typing in the search input MUST remain responsive

### Requirement: Branch comparison uses direct branch diff
The system SHALL compare branches directly between the selected base/target branch tip and head/source branch tip.

#### Scenario: Comparison data is loaded
- **WHEN** the modal loads comparison data for a selected base/target branch and selected head/source branch
- **AND** the selected branches are different
- **THEN** the diff MUST represent changes from the selected base/target branch tip to the head/source branch tip
- **AND** the result MUST show files changed between those branch tips

#### Scenario: Changed files are shown
- **WHEN** comparison data loads successfully
- **THEN** the modal MUST show the files changed between the selected base/target branch and head/source branch
- **AND** each file row MUST include its status and line change counts when available

#### Scenario: Comparison has no changed files
- **WHEN** the selected base/target branch and head/source branch have no changed files under direct branch comparison
- **THEN** the modal MUST show an empty state instead of a stale file list or stale diff

### Requirement: Branch comparison modal presents file list and diff viewer
The system SHALL present branch comparison in a modal with editable branch endpoints, file navigation, and a diff viewer.

#### Scenario: Modal header renders comparison direction
- **WHEN** the branch comparison modal is open
- **THEN** the header MUST present `Show changes in` before the head/source selector
- **AND** the header MUST present `against` before the base/target selector
- **AND** a swap control MUST be available between the selectors

#### Scenario: User selects a changed file
- **WHEN** the user selects a file from the changed file list
- **THEN** the right side of the modal MUST show that file's diff for the active branch comparison

#### Scenario: User switches diff display mode
- **WHEN** the user switches between `Unified` and `Split` display modes
- **THEN** the selected file MUST remain selected
- **AND** the visible diff MUST continue to represent the same active branch comparison

#### Scenario: User closes modal
- **WHEN** the user closes the branch comparison modal
- **THEN** the modal MUST be removed from view
- **AND** branch list selection and checkout state MUST NOT change as a side effect

### Requirement: Branch comparison supports draft line comments
The system SHALL support draft-only GitHub-style review threads in the branch comparison modal.

#### Scenario: User adds a line comment
- **WHEN** the user starts a comment on a rendered diff line
- **AND** the user saves non-empty Markdown text
- **THEN** the system MUST show a review thread attached to that line
- **AND** the thread MUST display the saved Markdown as a rendered comment body

#### Scenario: User composes with Markdown toolbar
- **WHEN** the user selects text in a comment composer
- **AND** the user activates a Markdown toolbar control
- **THEN** the selected text MUST be transformed into the corresponding Markdown syntax in the composer

#### Scenario: User previews a Markdown draft
- **WHEN** the user switches a composer from `Write` to `Preview`
- **THEN** the composer MUST render the current Markdown draft using GitHub-flavored Markdown support
- **AND** unsafe HTML MUST NOT execute

#### Scenario: User inserts emoji
- **WHEN** the user chooses an emoji from the composer emoji control
- **THEN** the emoji MUST be inserted into the Markdown draft at the current cursor or selection

#### Scenario: User replies to a review thread
- **WHEN** the user saves a non-empty reply in an existing line thread
- **THEN** the system MUST append the reply as a new comment in the same thread
- **AND** the thread MUST remain attached to the original diff line

#### Scenario: User edits a draft comment
- **WHEN** the user edits an existing draft comment
- **AND** the user saves non-empty updated Markdown text
- **THEN** the system MUST update the visible comment body
- **AND** the comment metadata MUST record an updated timestamp

#### Scenario: User deletes a draft comment
- **WHEN** the user deletes an existing draft comment
- **THEN** the system MUST remove that draft comment from the thread
- **AND** the system MUST remove the thread if no comments remain in it

#### Scenario: User resolves a review thread
- **WHEN** the user resolves an existing review thread
- **THEN** the system MUST mark the thread as resolved for the current modal session
- **AND** the user MUST be able to reopen the thread during the same modal session

#### Scenario: User switches display mode with comments
- **WHEN** the user switches between `Unified` and `Split` display modes
- **THEN** draft review threads MUST remain attached to their original diff lines
- **AND** split view threads MUST render in a row wide enough for the review thread content rather than inside only one side cell

#### Scenario: User changes file with comments
- **WHEN** the user selects another file and later returns to a previously commented file
- **THEN** draft review threads for the active branch comparison MUST still be visible for that file

#### Scenario: User closes modal with comments
- **WHEN** the user closes the branch comparison modal
- **THEN** all draft review threads created in that modal session MUST be discarded
- **AND** reopening the modal MUST NOT restore those discarded draft review threads

### Requirement: Branch comparison models review comment data for future persistence
The system SHALL model branch comparison review comments with future PR persistence in mind while keeping current data draft-only.

#### Scenario: Review thread is created
- **WHEN** a user creates a line comment thread
- **THEN** the thread model MUST include a stable thread id, comparison pair key, file path, diff line anchor, resolution state, comments, and attachment placeholders

#### Scenario: Review comment is created
- **WHEN** a user saves a comment or reply
- **THEN** the comment model MUST include a stable comment id, thread id, author metadata, Markdown body, created timestamp, updated timestamp, lifecycle state, and reactions collection

#### Scenario: Modal session ends
- **WHEN** the branch comparison modal closes
- **THEN** all review thread data MUST be discarded from memory
- **AND** no backend persistence MUST be attempted

### Requirement: Branch comparison supports local AI analysis
The system SHALL expose premium local AI branch analysis from the branch comparison review surface as a report-oriented action distinct from AI code review.

#### Scenario: User opens branch comparison
- **WHEN** the branch comparison modal is open with a selected base/target branch and head/source branch
- **AND** the selected branches are different
- **THEN** the modal MUST offer a local AI analysis action for the active comparison
- **AND** the modal MUST present analysis as distinct from AI review of changed code

#### Scenario: User starts branch analysis
- **WHEN** the user activates local AI analysis for the active branch comparison
- **THEN** the system MUST run branch analysis using the active base/target branch, head/source branch, and comparison mode
- **AND** the modal MUST show progress while local analysis is running

#### Scenario: Branch analysis succeeds
- **WHEN** local AI branch analysis completes
- **THEN** the modal MUST show a structured report with summary, risk assessment, behavioral changes, potential regressions, test gaps, recommendations, and action items
- **AND** the modal MUST NOT show a raw changed-file chip list as the analysis output
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: User changes comparison inputs
- **WHEN** the user changes the base/target branch or head/source branch for the comparison
- **THEN** the local AI analysis action MUST use a new Git input digest
- **AND** stale analysis for the previous comparison MUST NOT be shown as current analysis

#### Scenario: Local AI setup is required
- **WHEN** the selected model is not ready for branch analysis
- **THEN** the system MUST route the user through local AI setup before running analysis

#### Scenario: Comparison cannot be analyzed
- **WHEN** either comparison endpoint is missing or both endpoints are the same branch
- **THEN** the local AI analysis action MUST be disabled

### Requirement: Branch comparison supports local AI code review
The system SHALL expose premium local AI code review from the branch comparison review surface as a changed-code feedback action distinct from branch analysis.

#### Scenario: User opens branch comparison
- **WHEN** the branch comparison modal is open with a selected base/target branch and head/source branch
- **AND** the selected branches are different
- **THEN** the modal MUST offer a local AI review action for the active comparison
- **AND** the modal MUST present review as distinct from branch analysis

#### Scenario: User starts branch review
- **WHEN** the user activates local AI review for the active branch comparison
- **THEN** the system MUST run branch review using the active base/target branch, head/source branch, and comparison mode
- **AND** the modal MUST show progress while local review is running

#### Scenario: Branch review succeeds
- **WHEN** local AI branch review completes
- **THEN** the branch comparison modal MUST show AI review findings that identify changed code needing attention
- **AND** each inline finding MUST be associated with a validated changed diff line before it is shown as inline feedback
- **AND** the result MUST identify whether it came from cache or a fresh local run

#### Scenario: Branch review has no actionable findings
- **WHEN** local AI branch review completes with a meaningful no-finding result
- **THEN** the branch comparison modal MUST show the model's no-finding summary
- **AND** the modal MUST distinguish that state from a model-output error

#### Scenario: Branch review output is unusable
- **WHEN** local AI branch review fails because the model returned unusable structured output
- **THEN** the branch comparison modal MUST show the failure through the local AI error path
- **AND** the modal MUST NOT show "No actionable review findings returned" as the final result

#### Scenario: Branch review has omitted context
- **WHEN** a branch review or branch analysis result includes omitted files or omitted sections metadata
- **THEN** the result modal MUST show a compact indication that context was omitted or truncated
- **AND** the indication MUST remain visible for both cached and fresh results

#### Scenario: User applies an AI finding
- **WHEN** the user applies an AI review finding as feedback
- **THEN** the system MUST create or update a bot-authored draft review thread at the finding's diff-line anchor
- **AND** the user MUST be able to edit or delete the draft comment before using it outside Gitano

#### Scenario: User dismisses an AI finding
- **WHEN** the user dismisses an AI review finding
- **THEN** the finding MUST be hidden from the active review result for the current modal session
- **AND** no draft review thread MUST be created for that dismissal

#### Scenario: User copies AI feedback
- **WHEN** the user copies selected AI review feedback
- **THEN** the system MUST copy PR-ready Markdown that includes the relevant file and line reference, finding title, explanation, and suggested comment

#### Scenario: User changes comparison inputs
- **WHEN** the user changes the base/target branch or head/source branch for the comparison
- **THEN** the local AI review action MUST use a new Git input digest
- **AND** stale review findings for the previous comparison MUST NOT be shown as current findings

#### Scenario: Local AI setup is required for review
- **WHEN** the selected model is not ready for branch review
- **THEN** the system MUST route the user through local AI setup before running review

#### Scenario: Comparison cannot be reviewed
- **WHEN** either comparison endpoint is missing or both endpoints are the same branch
- **THEN** the local AI review action MUST be disabled

### Requirement: Branch comparison supports pull request review mode
The system SHALL allow the branch comparison review surface to run in a pull request review mode backed by GitHub pull request context.

#### Scenario: Pull request review opens
- **WHEN** a user opens `Review` for a GitHub pull request
- **THEN** Gitano MUST open the branch comparison review surface in pull request review mode
- **AND** the comparison MUST use the pull request base ref as the target side
- **AND** the comparison MUST use the pull request head ref as the source side
- **AND** opening the review MUST NOT change the user's checked-out branch

#### Scenario: Pull request refs are unavailable locally
- **WHEN** a user opens a GitHub pull request review
- **AND** the required base or head refs are not available locally
- **THEN** Gitano MUST prepare the required refs before loading the comparison
- **AND** Gitano MUST show a recoverable error if the refs cannot be prepared

#### Scenario: Pull request review header is rendered
- **WHEN** the branch comparison review surface is in pull request review mode
- **THEN** the header MUST identify the pull request being reviewed
- **AND** the header MUST expose `Analyze`, `Review`, and `Comments` actions
- **AND** the header MUST NOT require the user to manually choose equivalent branch endpoints before review can begin

### Requirement: Pull request review mode loads comments side panel
The system SHALL provide a comments side panel in pull request review mode.

#### Scenario: User opens Comments
- **WHEN** the user activates `Comments` in pull request review mode
- **THEN** Gitano MUST open a side panel in the review surface
- **AND** the panel MUST load pull request conversation and review comments for the selected pull request

#### Scenario: Comments load successfully
- **WHEN** GitHub pull request comments load successfully
- **THEN** the comments side panel MUST show existing comments with author, body, timestamp, and file or line context when available
- **AND** inline review comments that match visible diff anchors MUST be associated with the corresponding file or line
- **AND** file-level review comments MUST be associated with the changed file header when possible
- **AND** review replies MUST be rendered as replies nested under their parent review comment

#### Scenario: User comments on a changed file
- **WHEN** the branch comparison review surface is in pull request review mode
- **THEN** each selected changed file MUST expose a file-level comment control before the file hunks
- **AND** created file-level comment threads MUST be collapsed by default

#### Scenario: User edits an existing review comment
- **WHEN** a loaded GitHub review comment is visible in the pull request review surface
- **THEN** Gitano MUST allow the user to edit that comment from the review thread
- **AND** Gitano MUST keep the edited body as a local draft review change
- **AND** Gitano MUST NOT persist the edited body through GitHub until the user submits review comments

#### Scenario: User resolves a review thread locally
- **WHEN** a user resolves a visible review thread in the pull request review surface
- **THEN** Gitano MUST persist the resolved state through GitHub when the thread has GitHub review thread metadata
- **AND** Gitano MUST collapse the thread
- **AND** Gitano MUST show a `Resolved` tag in the thread header
- **AND** Gitano MUST expose a `Reopen conversation` action when the resolved thread is expanded
- **AND** Gitano MUST report GitHub resolve or reopen failures through the global action notice

#### Scenario: Comments fail to load
- **WHEN** GitHub pull request comments fail to load
- **THEN** the comments side panel MUST show a concise failure state
- **AND** detailed failure information MUST be available without closing the review surface

### Requirement: Pull request review comments can be submitted from draft threads
The system SHALL allow draft review threads created in pull request review mode to be submitted as GitHub pull request review comments.

#### Scenario: User submits draft comments as a review
- **WHEN** the user has draft review comments in pull request review mode
- **AND** the user submits a comment-only review
- **THEN** Gitano MUST translate each valid draft thread anchor into a GitHub review comment
- **AND** Gitano MUST submit the comments as a GitHub `COMMENT` review
- **AND** Gitano MUST submit file-level draft comments using GitHub file-level review comment semantics
- **AND** Gitano MUST submit draft replies to existing review comments using GitHub reply semantics instead of creating a new line comment
- **AND** Gitano MUST persist pending edits to existing GitHub review comments as part of the same submit action

#### Scenario: Draft comment anchor is invalid
- **WHEN** a draft review comment cannot be mapped to the current GitHub pull request diff
- **THEN** Gitano MUST prevent submission of that invalid comment
- **AND** Gitano MUST explain which comment cannot be submitted
- **AND** valid unsent draft comments MUST remain available for correction or retry

#### Scenario: Pull request review surface closes
- **WHEN** the pull request review surface closes with unsubmitted draft comments
- **THEN** Gitano MUST discard the unsubmitted draft comments for that modal session
- **AND** Gitano MUST NOT submit them to GitHub automatically
