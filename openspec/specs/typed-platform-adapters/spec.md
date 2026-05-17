# typed-platform-adapters Specification

## Purpose
Define typed frontend adapter boundaries for Tauri platform integrations and backend Git command invocation.

## Requirements
### Requirement: Typed Tauri command adapters
The frontend SHALL access backend Tauri commands through typed adapter functions instead of raw command invocation from render-focused components.

#### Scenario: Git command call
- **WHEN** frontend code needs data or side effects from a Rust Git command
- **THEN** it MUST call a typed adapter or feature API function with explicit request and response types
- **THEN** the command string MUST be centralized in the adapter layer

#### Scenario: Component renders workflow UI
- **WHEN** a React component renders workflow UI
- **THEN** it MUST NOT embed raw Tauri command strings unless the component is itself an adapter boundary

### Requirement: Platform integration wrappers
The frontend SHALL wrap reusable Tauri platform integrations in shared platform modules.

#### Scenario: Dialog integration
- **WHEN** multiple features need file or directory dialog behavior
- **THEN** they MUST use a shared platform dialog wrapper instead of importing the Tauri dialog plugin directly in each feature

#### Scenario: Event integration
- **WHEN** multiple features listen for app or backend events
- **THEN** they MUST use typed event helpers that document event names and payload types

#### Scenario: Storage integration
- **WHEN** persisted frontend state is stored through Tauri storage
- **THEN** it MUST use a shared typed storage adapter that preserves existing persisted state keys during migration

#### Scenario: Window integration
- **WHEN** app startup or layout code needs Tauri window APIs
- **THEN** it MUST use a shared platform window adapter unless the code is the app bootstrap boundary

### Requirement: Adapter testability
The frontend SHALL make platform and Git command adapters testable without requiring a live Tauri runtime.

#### Scenario: Adapter dependency is mocked
- **WHEN** tests exercise feature hooks, stores, or API modules that depend on platform adapters
- **THEN** the platform calls MUST be mockable at the adapter boundary

#### Scenario: Adapter preserves command contract
- **WHEN** a command adapter is tested
- **THEN** the test MUST be able to verify the command name and payload shape without invoking the Rust backend

