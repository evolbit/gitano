## ADDED Requirements

### Requirement: Optimized staging paths preserve immediate Git index updates
The system SHALL preserve immediate Git index staging semantics when Current Changes uses lazy diff detail loading or batched path operations.

#### Scenario: User stages lines from a lazily loaded working diff
- **WHEN** the user stages or unstages a line or block in a working-tree diff that was loaded through the lazy detail path
- **THEN** the system MUST immediately apply that selection to the Git index
- **AND** the summary and detail staged state MUST refresh or reconcile after the Git operation completes

#### Scenario: User stages multiple files through a batch operation
- **WHEN** the user stages multiple Current Changes files through a folder or bulk action
- **THEN** the Git index MUST be updated before the operation is treated as successful
- **AND** the UI MUST NOT rely solely on optimistic staged state after the backend operation settles

#### Scenario: Batch staging operation fails
- **WHEN** a batch Current Changes staging or unstaging operation fails
- **THEN** the system MUST restore or refresh staged UI state from the Git index
- **AND** the user MUST receive an error instead of seeing silently confirmed staged state
