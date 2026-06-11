## ADDED Requirements

### Requirement: Tags panel filters by local and origin presence
The system SHALL let users filter the unified tags panel by local and origin tag presence with non-empty toggle controls.

#### Scenario: Tags panel is visible
- **WHEN** the tags panel is visible
- **THEN** the panel top bar MUST include local computer and remote cloud filter toggles
- **THEN** both toggles MUST be active by default when no persisted preference exists

#### Scenario: User enables both tag filters
- **WHEN** both local and remote tag filters are active
- **THEN** the tags panel MUST show all known local tags, origin tags, and tags present in both locations

#### Scenario: User enables only local tag filter
- **WHEN** only the local tag filter is active
- **THEN** the tags panel MUST show tags that are present locally
- **THEN** tags that are also present on origin MUST remain visible
- **THEN** origin-only tags MUST be hidden

#### Scenario: User enables only remote tag filter
- **WHEN** only the remote tag filter is active
- **THEN** the tags panel MUST show tags that are present on origin
- **THEN** tags that are also present locally MUST remain visible
- **THEN** local-only tags MUST be hidden

#### Scenario: User attempts to disable the last active tag filter
- **WHEN** exactly one tag location filter is active
- **AND** the user activates that active filter control
- **THEN** the system MUST keep that filter active
- **THEN** the tags panel MUST NOT enter a no-location-filter state

## MODIFIED Requirements

### Requirement: Tags panel presents local and origin tag state
The system SHALL present local and origin tags in one unified tags panel with explicit local and remote icon indicators for each tag name.

#### Scenario: Tag exists locally and on origin with the same object
- **WHEN** a tag name exists locally and on `origin`
- **AND** the local and origin tag refs point to the same direct tag object id
- **THEN** the tags panel MUST render one row for that tag
- **THEN** the row MUST show both local computer and remote cloud indicators in the resolved row text color

#### Scenario: Tag exists only locally
- **WHEN** a tag name exists locally but not on `origin`
- **THEN** the tags panel MUST render one row for that tag
- **THEN** the row MUST show the local computer indicator in the resolved row text color
- **THEN** the row MUST NOT show the remote cloud indicator as present

#### Scenario: Tag exists only on origin
- **WHEN** a tag name exists on `origin` but not locally
- **THEN** the tags panel MUST render one row for that tag
- **THEN** the row MUST show the remote cloud indicator in the resolved row text color
- **THEN** the row MUST NOT show the local computer indicator as present

#### Scenario: Tag exists locally and on origin with different objects
- **WHEN** a tag name exists locally and on `origin`
- **AND** the local and origin tag refs point to different direct tag object ids
- **THEN** the tags panel MUST render one row for that tag
- **THEN** the row MUST show both local computer and remote cloud indicators
- **THEN** the row MUST communicate through tooltip or accessible text that the local and origin tags point to different objects

#### Scenario: Origin tags cannot be loaded
- **WHEN** local tags can be loaded
- **AND** origin tags cannot be loaded because `origin` is missing, unreachable, or unavailable
- **THEN** the tags panel MUST continue to render local tags
- **THEN** rows whose remote state cannot be confirmed MUST show the remote indicator in a muted unknown style or otherwise communicate that origin state is unavailable

#### Scenario: Local tags load before origin tags
- **WHEN** local tag refs load successfully
- **AND** origin tag refs are still loading
- **THEN** the tags panel MUST render the local tag rows without waiting for origin lookup to complete
- **THEN** rows whose origin state is not yet known MUST show pending local/remote indicators in a muted grey style until origin lookup resolves

#### Scenario: User inspects tag state icon
- **WHEN** the user hovers or focuses a tag state icon
- **THEN** the system MUST show a tooltip identifying whether the icon represents the local tag, origin tag, pending/unknown origin state, or a local/origin conflict

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
