## Why

AI commit message generation currently does not work when the selected analysis engine is an external agent. Users should be able to use the same commit-message action seamlessly whether the active engine is a local model or an external ACP agent.

## What Changes

- Fix the commit message generation path so it respects the selected analysis engine.
- Ensure local model setup checks run only for local model selections.
- Ensure external-agent commit message runs use the external agent execution path and surface progress or errors consistently.
- Add focused coverage for local-model and external-agent commit-message flows.

## Capabilities

### New Capabilities

### Modified Capabilities
- `local-ai-git-analysis`: Clarify that commit message generation must route through the selected engine without forcing local model readiness for external agents.
- `external-ai-agents`: Clarify that external-agent commit message generation must be executable from the commit UI and return a usable message.

## Impact

- Current changes commit bar AI button behavior.
- Frontend local AI setup gate for commit-message actions.
- Shared local AI action API and tests.
- No dependency or storage changes.
