## Why

Gitano currently treats AI analysis as local model execution, which limits users who already use full coding agents such as Codex for deeper analysis. Adding curated ACP external agents lets Gitano offer richer analysis options while keeping agent authentication, billing, and data-sharing decisions under the user's own agent account.

## What Changes

- Add a curated External Agents settings surface for ACP-backed agents, starting with Codex CLI, Claude Agent, and Gemini CLI.
- Add an analysis engine abstraction so Gitano can distinguish local models from external ACP agents in settings, dropdowns, execution, and persistence.
- Group the analysis selector into Local models and External agents instead of mixing ACP agents into the model list.
- Install, update, detect, authenticate, and remove curated ACP agents through backend-owned commands where supported by the ACP registry metadata.
- Stream ACP session updates into Gitano's AI analysis UI instead of waiting only for a final response.
- Clear persisted warm model preferences when the active analysis engine changes to an external agent, and prevent startup warmup from running unless the active engine is a local model.
- Keep custom ACP agents and a full public ACP registry browser out of scope for the first version.

## Capabilities

### New Capabilities

- `external-ai-agents`: Curated ACP external agent discovery, installation, update detection, authentication, status, selection, streaming execution, and agent lifecycle behavior.

### Modified Capabilities

- `local-ai-model-management`: Settings and warmup behavior must account for analysis engines, hiding and clearing warmup when an external agent is selected.
- `local-ai-git-analysis`: Git analysis actions must route through the selected analysis engine, stream external agent progress, and preserve local-model-only behavior where applicable.

## Impact

- Frontend settings UI, analysis engine dropdowns, and AI action status/progress rendering.
- Shared TypeScript API types for AI engines, external agent status, installation, update availability, authentication, and streamed events.
- Tauri/Rust backend commands for curated ACP agent registry metadata, install/update/remove, status, auth, session startup, prompt execution, cancellation, and stream emission.
- Local AI preference persistence and migration from model-only preferences to an engine-aware shape.
- Startup warmup path, warm model preference reconciliation, and model warmup controls.
- Tests for engine selection, warmup reset/guarding, curated agent UI, ACP status handling, and streamed analysis updates.
