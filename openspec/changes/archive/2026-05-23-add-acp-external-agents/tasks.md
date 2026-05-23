## 1. Engine Preferences and Warmup Scope

- [x] 1.1 Add Rust and TypeScript `AnalysisEngine` types that distinguish `local_model` from `external_agent`.
- [x] 1.2 Extend persisted local AI preferences to store a global analysis engine and action-specific engine overrides while deserializing existing model-only preferences.
- [x] 1.3 Migrate existing global and action-specific model preferences to local-model engine preferences on preference load.
- [x] 1.4 Clear `warmModelIds` in the backend when any global or action-specific engine preference is changed to an ACP agent.
- [x] 1.5 Guard startup and settings-triggered warmup so no local runtime starts unless the selected analysis engine is local-model based.
- [x] 1.6 Add backend unit tests for preference migration, external-agent warmup clearing, and warmup no-op behavior.

## 2. Curated External Agent Backend

- [x] 2.1 Add a curated agent allowlist for Codex CLI (`codex-acp`), Claude Agent (`claude-acp`), and Gemini CLI (`gemini`).
- [x] 2.2 Add backend types and commands for external agent catalog/status, install, remove, authenticate, and set-as-default actions.
- [x] 2.3 Resolve install metadata for allowlisted agents from ACP registry data or Gitano-owned fallback metadata.
- [x] 2.4 Install curated agents into a Gitano-managed agent directory and reject install requests for non-allowlisted ids.
- [x] 2.5 Detect installed agent version, authentication-required state, ready state, and failed state for each curated agent.
- [x] 2.6 Add backend tests for allowlist filtering, unsupported id rejection, install metadata validation, and status mapping.
- [x] 2.7 Keep update availability and update commands out of this archived change; defer version-refresh metadata to a future change.

## 3. ACP Session Runtime

- [x] 3.1 Add an ACP stdio process client for starting a curated agent, initializing JSON-RPC transport, and cleaning up child processes.
- [x] 3.2 Implement ACP session creation, prompt sending, cancellation, and final stop-reason handling for analysis runs.
- [x] 3.3 Normalize ACP session updates into Gitano streaming events for text, progress, plan changes, file-read activity, denied terminal activity, errors, and completion.
- [x] 3.4 Implement read-only repository file access for ACP requests scoped to the active repository.
- [x] 3.5 Auto-allow safe read-only repository inspection commands and reject file-write, edit, destructive terminal, path-escape, and shell-control requests without treating expected denials as Gitano application failures.
- [x] 3.6 Add runtime tests for session update normalization, cancellation, scoped read access, and write/terminal denial.
- [x] 3.7 Capture ACP `configOptions` from `session/new`, apply valid stored values with `session/set_config_option`, and support legacy `modes` through `session/set_mode`.
- [x] 3.8 Detect stalled ACP transports and emit failed run events that tell the user to check internet connectivity.

## 4. Shared Frontend API and State

- [x] 4.1 Extend shared API types with external agent catalog entries, status states, auth methods, install/remove responses, and streaming analysis events.
- [x] 4.2 Add frontend API wrappers for external agent catalog/status, install, remove, authenticate, set engine preference, and stream subscription commands.
- [x] 4.3 Update settings load state to include analysis engine preferences, curated agent status, and warmup state from the backend.
- [x] 4.4 Add frontend tests for API request/response mapping and engine preference payloads.

## 5. Settings UI

- [x] 5.1 Add an `External Agents` pane to the AI settings sidebar.
- [x] 5.2 Render the three curated agents with status, install, authenticate, remove, and set-as-default actions based on backend state.
- [x] 5.3 Replace model-only configuration selectors with grouped analysis engine selectors for Local models and External agents.
- [x] 5.4 Hide or disable warmup controls when the selected engine is an external agent.
- [x] 5.5 Ensure selecting an external agent updates UI state to show cleared warm preferences after the backend saves the engine preference.
- [x] 5.6 Add settings UI tests for the External Agents pane, grouped engine dropdown, not-ready agent setup routing, and warmup reset display.
- [x] 5.7 Render ACP-provided external agent config dropdowns under global and action-specific external agent rows.
- [x] 5.8 Persist global and action-specific external agent config selections and show compact row warnings when config discovery fails.

## 6. Git Analysis Routing and Streaming UI

- [x] 6.1 Route commit analysis, branch analysis, and branch review through the selected analysis engine.
- [x] 6.2 Preserve the existing local model execution path when the selected engine is `local_model`.
- [x] 6.3 Build lightweight ACP prompts from backend-owned Git descriptors so agents inspect diffs through read-only repository capabilities instead of receiving full code or diff hunks.
- [x] 6.4 Add external-agent cache keys that include action kind, prompt version, agent id, agent version when known, repository identity, and Git input digest.
- [x] 6.5 Stream external agent progress into existing commit and branch analysis progress surfaces.
- [x] 6.6 Convert completed external agent output into the existing Gitano-owned final analysis or review result shape when usable.
- [x] 6.7 Show user-facing errors for ACP startup, auth, transport, session, and interrupted-stream failures without presenting partial output as complete.
- [x] 6.8 Collapse external agent activity rows by default with ellipsis, hover/focus chevrons, expandable wrapped content, and automatic scroll-to-bottom behavior.

## 7. Verification

- [x] 7.1 Add or update integration tests for local-engine analysis, external-agent setup-required routing, external-agent streaming, and cache separation.
- [x] 7.2 Add regression tests proving local warmup does not run after an external agent is selected and Gitano is reopened.
- [x] 7.3 Run frontend tests for settings and analysis surfaces.
- [x] 7.4 Run Rust tests for AI preference, warmup, external agent, and ACP runtime modules.
- [x] 7.5 Verify install/status/auth-ready, grouped engine selection, external config, streaming progress, and timeout behavior through focused automated tests and build checks.
