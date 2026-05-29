## ADDED Requirements

### Requirement: Current Changes refresh lifecycle is coalesced and stale-safe
The system SHALL coalesce overlapping Current Changes refresh requests and prevent stale refresh responses from replacing newer state.

#### Scenario: Refresh is requested while another refresh is in flight
- **WHEN** a Current Changes refresh is already in flight
- **AND** another Current Changes refresh is requested
- **THEN** the system MUST avoid starting unbounded duplicate refresh requests
- **AND** the system MUST run at most one follow-up refresh after the in-flight request settles when another refresh was requested

#### Scenario: Older refresh response completes after a newer response
- **WHEN** multiple Current Changes refresh requests complete out of order
- **THEN** the system MUST apply only the latest valid response
- **AND** an older response MUST NOT reset file summaries, staged state, selected file detail, or scroll state

#### Scenario: Realtime events arrive in a burst
- **WHEN** realtime working-tree or index events request repeated Current Changes refreshes in a short period
- **THEN** the system MUST preserve prompt refresh behavior for the first request
- **AND** repeated events MUST be coalesced so the backend is not asked to recompute the same summary unboundedly
