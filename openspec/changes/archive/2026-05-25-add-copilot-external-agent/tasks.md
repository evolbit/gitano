## 1. Backend Catalog

- [x] 1.1 Add a `COPILOT_AGENT_ID` constant and curated GitHub Copilot CLI entry to `src-tauri/src/ai/external_agents/catalog.rs`.
- [x] 1.2 Configure Copilot with the ACP registry id `github-copilot-cli` and `@github/copilot` npm-exec distribution using `--acp`.
- [x] 1.3 Add Copilot-specific authentication method metadata that matches GitHub Copilot CLI account/token authentication.
- [x] 1.4 Update external agent catalog/status tests to include Codex, Claude, Gemini, and Copilot in the expected curated id list.
- [x] 1.5 Add a backend test that Copilot command resolution includes the registry npm-exec ACP arguments after npm is resolved.
- [x] 1.6 Restore Gitano-managed ACP adapter install metadata for curated registry-backed agents.
- [x] 1.7 Detect npm from PATH and OS-specific shell-managed binary directories, then pass the effective PATH to spawned npm-backed ACP agents.
- [x] 1.8 Prefer binary registry distributions for Codex on supported platforms and use npm-exec for npx registry distributions.
- [x] 1.9 Return a precise npm/ACP-adapter error when npm is unavailable instead of telling users to install provider CLIs.

## 2. Agent-Specific Settings

- [x] 2.1 Add settings test fixtures for Copilot and at least one existing external agent with different ACP `model` option values.
- [x] 2.2 Add or update settings tests to assert the Configuration pane renders only the selected agent's returned option labels and values.
- [x] 2.3 Add or update settings tests to assert changing an external agent option persists the value under the selected agent id.
- [x] 2.4 Adjust settings config loading or rendering only if tests show stale options from another agent can appear in the selected row.
- [x] 2.5 Hide and skip ACP config options that require unsupported client services, including Copilot's `allow_all` permission option.

## 3. Frontend Catalog Coverage

- [x] 3.1 Update shared API or settings tests that assert curated external agent catalog shape to cover the Copilot entry.
- [x] 3.2 Verify external agent selectors continue to group Copilot under External agents and disable it when status is unavailable.
- [x] 3.3 Restore Gitano-managed Install and Remove actions for ACP adapter distributions in the External Agents settings pane.
- [x] 3.4 Keep installed-but-unverified external adapters labeled separately from authenticated or ready agents.

## 4. Copilot Output Robustness

- [x] 4.1 Add an app-owned JSON-only output contract behind every local and external AI prompt.
- [x] 4.2 Keep per-action custom instructions unable to remove Gitano's required structured result shape.
- [x] 4.3 Keep unparseable analysis transcripts visible without presenting parser errors as risk assessments.
- [x] 4.4 Return unparseable external agent final output as a failed AI action with reportable debug payload data.
- [x] 4.5 Show exact AI action error/report data beside branch Analyze/Review buttons and preserve formatting in result modals.
- [x] 4.6 Keep output/parser/debug failures out of the analysis-engine setup flow.
- [x] 4.7 Promote plain-text external agent runtime errors, including Copilot authorization failures, instead of showing them primarily as parser failures.
- [x] 4.8 Show compact AI errors in every action surface and modal while keeping full report data in the log/copy paths.
- [x] 4.9 Classify external-agent progress-only transcripts as missing structured results instead of JSON parser failures.
- [x] 4.10 Acknowledge Copilot `report_intent` ACP client requests as progress instead of rejecting them.
- [x] 4.11 Prefer non-plan Copilot ACP sessions for read-only analysis runs and retry one same-session structured-output correction when a normal turn returns no JSON.

## 5. Verification

- [x] 5.1 Run `cargo test` from `src-tauri`.
- [x] 5.2 Run `pnpm run lint`.
- [x] 5.3 Run `pnpm test`.
- [x] 5.4 Run `pnpm run build`.
