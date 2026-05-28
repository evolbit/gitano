## Purpose

Define how regular branch comparison, pull request review, reusable comparison surfaces, and modal presentation wrappers are composed.

## Requirements

### Requirement: Branch comparison and pull request review have separate workflow owners
The system SHALL separate regular branch comparison workflow ownership from pull request review workflow ownership while preserving existing user-facing behavior.

#### Scenario: User opens regular branch comparison
- **WHEN** the user opens a regular branch comparison
- **THEN** the regular comparison workflow MUST own branch selection, selected file state, comparison display state, and generic branch comparison actions
- **AND** the workflow MUST NOT own GitHub pull request review comments, review submission state, pull request conversation state, or pull request merge state

#### Scenario: User opens pull request review
- **WHEN** the user opens review for a pull request
- **THEN** the pull request review workflow MUST own pull request context, review comments, draft review threads, pending submitted-comment edits, review submission state, pull request conversation state, merge state, and PR-specific AI review behavior
- **AND** the workflow MUST preserve the existing ability to review pull request diffs, draft comments, submit reviews, view conversations, and merge pull requests

### Requirement: Comparison workflows are independent from modal presentation
The system SHALL provide core comparison workflow components that can be rendered independently from modal wrappers.

#### Scenario: Workflow is presented as a modal
- **WHEN** regular branch comparison or pull request review is presented as a modal
- **THEN** the modal wrapper MUST own portal, overlay, sizing, and close presentation behavior
- **AND** the modal wrapper MUST delegate workflow state and workflow actions to the core workflow component

#### Scenario: Workflow component is rendered outside a modal
- **WHEN** a core comparison workflow component is rendered outside its modal wrapper
- **THEN** the workflow MUST still own its comparison or review behavior through props, local workflow state, focused context, and existing data hooks
- **AND** the workflow MUST NOT require modal-specific context to function

### Requirement: Comparison layout is reusable without owning review business logic
The system SHALL reuse comparison layout or composition pieces between regular branch comparison and pull request review without moving PR review business logic into generic rendering components.

#### Scenario: Shared comparison surface is rendered
- **WHEN** either workflow renders the changed-file explorer and diff viewing surface
- **THEN** the workflow MUST use reusable comparison composition where practical
- **AND** the reusable composition MUST NOT own GitHub pull request review submission, pull request merge, draft review thread, or PR conversation rules

#### Scenario: Shared extraction would introduce cross-feature coupling
- **WHEN** extracting reusable comparison pieces would require a shared module to import feature-owned workflow code
- **THEN** the implementation MUST choose a dependency-safe boundary such as a neutral layout component, render-node composition, or minimal promotion of generic pieces
- **AND** the implementation MUST NOT introduce new feature-to-feature dependencies that violate the project dependency direction

### Requirement: Diff viewer remains a generic interaction surface
The system SHALL keep diff rendering generic and receive review-specific behavior from parent workflows through focused extension points.

#### Scenario: Pull request comments are shown in a diff
- **WHEN** pull request review renders line or file comments inside the diff
- **THEN** the pull request review workflow MUST provide the comment rendering and mutation behavior to the diff surface
- **AND** the diff viewer MUST NOT own GitHub pull request numbers, GitHub review comment IDs, review submission events, or draft-versus-submitted review lifecycle rules

#### Scenario: User interacts with a diff comment control
- **WHEN** the user adds, updates, deletes, replies to, or resolves a review comment from the diff surface
- **THEN** the diff viewer MUST propagate the interaction to the owning pull request review workflow through focused context or callbacks
- **AND** the pull request review workflow MUST apply the corresponding PR review state changes

### Requirement: Refactor preserves current workflow behavior
The system SHALL preserve existing branch comparison and pull request review behavior during the component decomposition.

#### Scenario: Existing regular comparison interactions are used
- **WHEN** the user performs existing regular branch comparison interactions after the refactor
- **THEN** branch selection, file selection, diff loading, display mode changes, and AI comparison actions MUST behave as they did before the refactor

#### Scenario: Existing pull request review interactions are used
- **WHEN** the user performs existing pull request review interactions after the refactor
- **THEN** PR diff loading, PR comment display, draft comment creation, review submission, conversation display, merge actions, and PR-specific AI review actions MUST behave as they did before the refactor
