## ADDED Requirements

### Requirement: Layered frontend source layout
The frontend SHALL expose a clear feature-first architecture with separate `app`, `features`, and `shared` layers.

#### Scenario: App composition is isolated
- **WHEN** a module owns application bootstrap, providers, shell composition, startup effects, or global tab orchestration
- **THEN** the module MUST live under `src/app` or a documented app entrypoint

#### Scenario: Feature-owned code is colocated
- **WHEN** a module is owned by a user-facing Git workflow such as branches, changes, commits, diffs, stashes, worktrees, tags, launchpad, repository tabs, or commit creation
- **THEN** the module MUST live under `src/features/<feature>` with its feature-owned components, hooks, stores, types, API adapters, utilities, and tests colocated

#### Scenario: Shared code is feature independent
- **WHEN** a module is reused across features or provides generic UI, generic hooks, pure utilities, constants, types, or platform integration
- **THEN** the module MUST live under `src/shared`
- **THEN** the module MUST NOT import from `src/features`

### Requirement: Dependency direction
The frontend SHALL keep dependencies flowing from app composition to features to shared infrastructure.

#### Scenario: Shared layer remains independent
- **WHEN** a shared module is imported
- **THEN** it MUST NOT depend on feature modules or app composition modules

#### Scenario: Feature modules use shared modules
- **WHEN** a feature needs reusable UI, platform access, generic utilities, or shared types
- **THEN** it MUST import those dependencies from `shared` rather than duplicating them locally

#### Scenario: Cross-feature access is explicit
- **WHEN** one feature needs behavior owned by another feature
- **THEN** the dependency MUST go through a documented public feature API or be promoted to `shared` if it is genuinely reusable

### Requirement: Incremental migration compatibility
The frontend SHALL support incremental migration from legacy top-level buckets without requiring a single all-at-once rewrite.

#### Scenario: Legacy imports remain buildable during migration
- **WHEN** a module is moved to a target architecture path while legacy consumers still exist
- **THEN** a compatibility export MAY preserve the old import path until the consumers are migrated

#### Scenario: New code uses target paths
- **WHEN** new or substantially changed code is added after the target path exists
- **THEN** it MUST import from the target architecture path instead of adding new dependencies on legacy buckets

#### Scenario: Compatibility exports are retired
- **WHEN** all consumers of a legacy compatibility export have moved to target paths
- **THEN** the compatibility export MUST be removed

### Requirement: Feature-local tests
The frontend SHALL colocate tests with the architecture layer that owns the tested behavior.

#### Scenario: Shared utility test
- **WHEN** a shared pure utility is added or migrated
- **THEN** it MUST have focused tests under the shared module or a nearby shared test folder

#### Scenario: Feature behavior test
- **WHEN** a feature hook, store, API adapter, or high-risk component behavior is added or migrated
- **THEN** it MUST have focused tests under the owning feature

#### Scenario: Refactor preserves behavior
- **WHEN** a migration slice moves modules without intentionally changing behavior
- **THEN** existing tests MUST pass and new tests MUST cover the moved behavior when practical

### Requirement: Stable import aliases
The frontend SHALL provide stable import aliases for cross-layer imports.

#### Scenario: Cross-layer import
- **WHEN** a module imports from another architecture layer
- **THEN** it SHOULD use a stable alias such as `@/shared`, `@/features`, or `@/app` rather than deep relative traversal

#### Scenario: Local feature import
- **WHEN** a module imports another module from the same feature subtree
- **THEN** local relative imports MAY be used to keep the feature self-contained
