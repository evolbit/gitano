## Purpose

Define how the current changes explorer stays responsive while periodic refreshes keep staged and working-tree state synchronized.

## Requirements

### Requirement: Working-changes refresh preserves scroll interaction when the snapshot is unchanged
The system SHALL avoid visibly disrupting the current changes explorer when a periodic working-changes refresh produces the same effective file snapshot as the previous refresh.

#### Scenario: Polling refresh returns the same file snapshot
- **WHEN** the working-changes refresh runs while the current changes explorer is visible
- **AND** the refreshed file snapshot is effectively unchanged from the previous snapshot
- **THEN** the explorer MUST remain visually stable
- **THEN** the explorer MUST NOT reset the scroll position or selection state solely because the refresh timer fired

#### Scenario: User is scrolling when an unchanged refresh completes
- **WHEN** the user is scrolling through the current changes list
- **AND** a periodic refresh completes with no meaningful snapshot change
- **THEN** the explorer MUST continue scrolling smoothly
- **THEN** the explorer MUST NOT visibly jump, stutter, or re-anchor the list solely due to the refresh

### Requirement: Working-changes refresh updates the explorer when the file snapshot meaningfully changes
The system SHALL update the current changes explorer when a refresh detects meaningful changes in the working tree.

#### Scenario: A file is added, removed, or changes status
- **WHEN** the refreshed working-changes snapshot contains a file that was not present before, no longer contains a previously visible file, or changes the visible status of a file
- **THEN** the current changes explorer MUST reflect the updated file set
- **THEN** the explorer MUST continue to present the correct tracked and untracked grouping for the refreshed snapshot

#### Scenario: A meaningful refresh occurs while the explorer is visible
- **WHEN** a working-changes refresh produces a different effective snapshot while the current changes explorer is visible
- **THEN** the explorer MUST update to the new snapshot
- **THEN** the update MUST preserve the current explorer mode and other persistent UI state where possible

### Requirement: Staged selection remains synchronized after refresh without forcing unnecessary rerenders
The system SHALL keep staged selection state synchronized with the latest repository state while avoiding unnecessary full-list replacement when refresh data has not changed.

#### Scenario: The staged index changes and the explorer refreshes
- **WHEN** the repository index changes and the working-changes refresh observes a different staged state for visible files
- **THEN** the explorer MUST reflect the updated staged selection state after refresh
- **THEN** the update MUST remain consistent with the existing immediate staging semantics

#### Scenario: Refresh completes with no staged-state change
- **WHEN** a periodic refresh completes and the staged selection state for the visible files is unchanged
- **THEN** the explorer MUST NOT rebuild the visible selection state solely for that unchanged refresh
- **THEN** unrelated files and rows MUST remain eligible for React render reuse where possible
