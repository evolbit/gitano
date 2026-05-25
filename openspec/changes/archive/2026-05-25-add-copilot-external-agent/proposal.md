## Why

Gitano already supports curated ACP-backed external agents, but GitHub Copilot CLI is not available as a selectable engine. Adding Copilot gives users who rely on GitHub's coding agent a first-class path while preserving the important guarantee that each agent's settings come from that agent's own ACP session metadata.

## What Changes

- Add GitHub Copilot to the curated external agent catalog using the ACP registry id and distribution metadata.
- Install curated ACP adapters the way Zed's registry flow does: prefer platform binary archives when available and use npm-exec for registry `npx` packages.
- Expose Copilot authentication methods that match the GitHub Copilot CLI account/token model.
- Keep Codex, Gemini, Claude, and Copilot settings agent-specific by discovering each selected agent's ACP `configOptions` before rendering model, mode, or other session controls.
- Ensure saved external agent option values are keyed by agent id and ignored when the selected agent no longer exposes that option or value.
- Treat provider CLIs and registry ACP adapters separately: Gitano installs or records the adapter distribution, while provider authentication still belongs to the provider tool/account.
- If npm is unavailable for `npx`-distributed adapters, fail setup/status with a message that names the ACP adapter package instead of implying the provider CLI is missing.
- Keep custom external agents and a general ACP registry browser out of scope.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `external-ai-agents`: The curated external agent catalog, registry-backed install metadata, command discovery, and ACP launch contract must include GitHub Copilot.
- `local-ai-model-management`: The settings surface must continue to render agent-provided configuration controls so Copilot, Codex, Gemini, and Claude can expose different model or mode choices without sharing stale settings, while showing install/remove actions for Gitano-managed ACP adapters.

## Impact

- Tauri external agent catalog, command resolution, status/auth method metadata, and Rust tests.
- External agent settings and configuration UI tests that assert agent-specific config discovery and persistence.
- Shared TypeScript fixtures/types only if existing external agent contracts need test coverage for the Copilot entry.
- OpenSpec requirements for curated external agents and AI settings configuration behavior.
