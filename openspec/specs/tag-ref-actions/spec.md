# tag-ref-actions Specification

## Purpose
Define how Gitano presents and manages local and origin tag refs, including tag state visibility, push, rename, and delete actions.

## Requirements

### Requirement: Tags panel presents local and origin tag state
The system SHALL present local and origin tags in one unified tags panel with a visible state for each tag name.

#### Scenario: Tag exists locally and on origin with the same object
- **WHEN** a tag name exists locally and on `origin`
- **AND** the local and origin tag refs point to the same direct tag object id
- **THEN** the tags panel MUST render one row for that tag
- **THEN** the row MUST show a `Local · Origin` state

#### Scenario: Tag exists only locally
- **WHEN** a tag name exists locally but not on `origin`
- **THEN** the tags panel MUST render one row for that tag
- **THEN** the row MUST show a `Local` state

#### Scenario: Tag exists only on origin
- **WHEN** a tag name exists on `origin` but not locally
- **THEN** the tags panel MUST render one row for that tag
- **THEN** the row MUST show an `Origin` state

#### Scenario: Tag exists locally and on origin with different objects
- **WHEN** a tag name exists locally and on `origin`
- **AND** the local and origin tag refs point to different direct tag object ids
- **THEN** the tags panel MUST render one row for that tag
- **THEN** the row MUST show a `Conflict` state

#### Scenario: Origin tags cannot be loaded
- **WHEN** local tags can be loaded
- **AND** origin tags cannot be loaded because `origin` is missing, unreachable, or unavailable
- **THEN** the tags panel MUST continue to render local tags
- **THEN** rows whose remote state cannot be confirmed MUST show an `Unknown` state or otherwise communicate that origin state is unavailable

#### Scenario: Local tags load before origin tags
- **WHEN** local tag refs load successfully
- **AND** origin tag refs are still loading
- **THEN** the tags panel MUST render the local tag rows without waiting for origin lookup to complete
- **THEN** rows whose origin state is not yet known MUST communicate unknown origin state until origin lookup resolves

#### Scenario: Tags panel remounts while tag queries are fresh
- **WHEN** the tags panel is opened again within the configured tag ref stale time
- **THEN** the system MUST reuse cached tag query data
- **THEN** the system MUST NOT refetch only because the panel remounted

#### Scenario: Explicit repo refs refresh happens
- **WHEN** an explicit fetch, push, tag mutation, or repo refs refresh event happens
- **THEN** the system MUST refresh active local and origin tag queries regardless of stale time

#### Scenario: Annotated remote tag refs are normalized
- **WHEN** origin returns both an annotated tag ref and its peeled `^{}` ref
- **THEN** the system MUST treat them as one tag row
- **THEN** direct tag ref object ids MUST be used to determine whether local and origin refs match

### Requirement: Tag context menus expose only executable tag actions
The system SHALL make tag row context menus contain executable actions for the selected tag state and remove non-implemented placeholder actions.

#### Scenario: User opens a concrete tag context menu
- **WHEN** the user opens the context menu for a concrete tag row
- **THEN** the menu MUST include only actions that can execute for that tag state or actions that are intentionally disabled because the current tag state prevents execution
- **THEN** the menu MUST NOT include `Solo` or `Hide`

#### Scenario: User opens a tag group context menu
- **WHEN** the user opens the context menu for a tag group row
- **THEN** the menu MUST NOT offer tag operations that require one concrete tag ref

#### Scenario: Tag action completes
- **WHEN** a tag push, rename, or delete action completes successfully
- **THEN** the system MUST refresh tag state from local and origin refs
- **THEN** the system MUST show operation feedback to the user

#### Scenario: Tag action fails
- **WHEN** a tag push, rename, or delete action fails
- **THEN** the system MUST keep the current tag panel usable
- **THEN** the system MUST show failure feedback containing the backend error details

### Requirement: User can push one local tag to origin
The system SHALL allow the user to push an individual local tag to `origin` from that tag row.

#### Scenario: User pushes a local-only tag
- **WHEN** the user activates `Push tag to origin` for a tag that exists locally and does not exist on `origin`
- **THEN** the system MUST push that tag ref to `origin`
- **THEN** the tag row MUST refresh to show `Local · Origin` when the push succeeds and origin reports the same object

#### Scenario: User pushes a tag that already exists on origin with the same object
- **WHEN** the selected tag already exists locally and on `origin` with the same direct tag object id
- **THEN** the system MUST NOT require a remote update
- **THEN** the context menu MUST either omit `Push tag to origin` or show it as unavailable with clear state

#### Scenario: User attempts to push a conflicting tag
- **WHEN** the selected tag exists locally and on `origin` with different direct tag object ids
- **THEN** the system MUST NOT force-update the remote tag
- **THEN** the context menu MUST either omit `Push tag to origin` or show it as unavailable with clear conflict state

#### Scenario: User pushes a tag without a remote branch
- **WHEN** the current branch does not exist on `origin`
- **AND** the user pushes a local tag from the tag row
- **THEN** the system MUST attempt the tag push without requiring the current branch to exist on `origin`

### Requirement: User can rename a local tag safely
The system SHALL allow the user to rename local tags without automatically publishing the renamed tag.

#### Scenario: User opens rename for a local tag
- **WHEN** the user activates `Rename tag` for a tag that exists locally
- **THEN** the system MUST show a rename dialog containing the current tag name and a new-name input
- **THEN** the dialog MUST communicate that rename is local-only and publishing must be done explicitly afterward

#### Scenario: New tag name already exists locally
- **WHEN** the user enters a new tag name that already exists locally
- **THEN** the system MUST disable rename confirmation
- **THEN** the system MUST show a validation message that the local tag name already exists

#### Scenario: New tag name already exists on origin
- **WHEN** the user enters a new tag name that is known to already exist on `origin`
- **THEN** the system MUST disable rename confirmation
- **THEN** the system MUST show a validation message that the origin tag name already exists

#### Scenario: Origin-name validation is unavailable
- **WHEN** the user enters a syntactically valid new tag name that does not exist locally
- **AND** the system cannot check whether the new name exists on `origin`
- **THEN** the system MUST allow local rename confirmation
- **THEN** the system MUST warn that pushing may fail later if the tag already exists on `origin`

#### Scenario: User confirms a valid local rename
- **WHEN** the user confirms a valid local tag rename
- **THEN** the system MUST create the new local tag name at the old tag target
- **THEN** the system MUST delete the old local tag name
- **THEN** the system MUST NOT push the new tag name to `origin`
- **THEN** the tags panel MUST refresh and show the renamed tag with its current local/origin state

#### Scenario: User renames an annotated tag
- **WHEN** the user renames an annotated local tag
- **THEN** the system MUST create an annotated tag using the new tag name
- **THEN** the system MUST preserve the original tag target and message where possible

### Requirement: User can delete local and origin tags explicitly
The system SHALL allow local tag deletion and origin tag deletion only through explicit delete actions.

#### Scenario: User deletes a local-only tag
- **WHEN** the user confirms deletion for a tag that exists only locally
- **THEN** the system MUST delete the local tag
- **THEN** the deleted tag MUST disappear from the tags panel after refresh

#### Scenario: User deletes a local tag that also exists on origin without deleting from origin
- **WHEN** the user confirms deletion for a tag that exists locally and on `origin`
- **AND** `Delete from origin too` is unchecked
- **THEN** the system MUST delete only the local tag
- **THEN** the tag MUST remain visible after refresh as an `Origin` tag

#### Scenario: User deletes a local tag and chooses to delete from origin
- **WHEN** the user confirms deletion for a tag that exists locally and on `origin`
- **AND** `Delete from origin too` is checked
- **THEN** the system MUST delete the tag from `origin`
- **THEN** the system MUST delete the local tag only after the origin deletion succeeds
- **THEN** the tag MUST disappear from the tags panel after refresh when no local or origin ref remains

#### Scenario: User deletes an origin-only tag
- **WHEN** the user confirms deletion for a tag that exists only on `origin`
- **THEN** the system MUST delete the tag from `origin`
- **THEN** the tag MUST disappear from the tags panel after refresh when no local or origin ref remains

#### Scenario: Origin deletion fails
- **WHEN** the user requested origin deletion
- **AND** the origin deletion fails
- **THEN** the system MUST show failure feedback
- **THEN** any existing local tag MUST remain available

#### Scenario: Delete dialog shows origin option only when origin tag is known
- **WHEN** the user deletes a local tag
- **AND** the system knows the tag exists on `origin`
- **THEN** the delete dialog MUST show an unchecked `Delete from origin too` checkbox
- **WHEN** the system does not know that the tag exists on `origin`
- **THEN** the delete dialog MUST NOT show the `Delete from origin too` checkbox
