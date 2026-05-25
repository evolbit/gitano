## Context

Gitano's external agent support is already centered on curated ACP agents. The backend owns catalog metadata, command resolution, status, and ACP session startup. The settings UI already asks the backend for ACP session configuration and renders returned `select` options per agent id.

GitHub Copilot is available in the ACP registry as an `npx` distribution. That means Gitano can add Copilot as another curated registry-backed ACP agent without treating Copilot as a local Ollama model or hard-coding Copilot-specific settings.

The distinction is between provider CLIs/accounts and ACP adapter distributions. Gitano should manage the adapter metadata or binary download from the curated registry shape, while provider authentication remains external. Zed follows this model: registry binary agents are downloaded into an external-agents cache, and registry `npx` agents are launched with npm exec under an agent-specific prefix.

## Goals / Non-Goals

**Goals:**
- Add GitHub Copilot CLI as a curated external agent.
- Use the ACP registry id `github-copilot-cli` and the registry `@github/copilot` package with `--acp`.
- Prefer binary registry distributions for agents such as Codex when the current OS/architecture has a target.
- Use npm exec for registry `npx` distributions such as Claude, Gemini, and Copilot.
- Detect npm from PATH and common shell-managed binary directories.
- Keep Copilot settings agent-provided through ACP session config discovery.
- Prevent Codex, Gemini, Claude, and Copilot option values from being shown or applied to the wrong agent.
- Cover catalog metadata, command construction, config rendering, and preference persistence with focused tests.

**Non-Goals:**
- Add a generic ACP registry browser.
- Add custom user-defined external agents.
- Install provider CLIs or credentials from Gitano.
- Hard-code Copilot model names, mode names, or settings in the frontend.
- Change local Ollama model selection or warmup behavior except where tests need to assert external-agent separation.

## Decisions

### Model each curated agent as registry-backed adapter metadata

Add a `COPILOT_AGENT_ID` constant with the registry id `github-copilot-cli`, display name `GitHub Copilot`, provider `GitHub`, and repository `https://github.com/github/copilot-cli`.

Store install distribution metadata in the catalog. Copilot should launch through the registry npm package:

```text
npm exec --yes -- @github/copilot@<registry-version> --acp
```

Codex should prefer the registry binary archive on supported platforms:

```text
./codex-acp
```

Claude, Gemini, and Copilot use registry `npx` distributions. Gitano should use `npm exec --yes -- <package> ...args` rather than requiring provider binaries such as `claude`, `gemini`, `codex`, or `copilot` to already exist.

### Install adapters, not provider CLIs

For a binary distribution, setup should download the current platform archive into Gitano's external agent data directory, extract it, and launch the configured relative command path with registry args.

For an `npx` distribution, setup should validate that npm can be resolved from the effective PATH and write adapter metadata into Gitano's external agent data directory. Launch should run npm exec with an agent-specific prefix directory so npm can cache the adapter independently.

If npm cannot be resolved, Gitano should show that npm is required for the ACP adapter package. The error must not say that Codex CLI, Claude CLI, Gemini CLI, or Copilot CLI is missing unless that is the actual command being launched.

### Show managed adapter actions in Settings

The catalog should expose an `installSource` for each supported curated agent. The External Agents pane should offer Install for not-installed adapter distributions, Refresh status for installed adapters whose provider authentication is unverified, Remove for installed adapters, and Set default only for available agents. Ready/authenticated state should be shown through the status label, not through a clickable authentication button.

Removal should delete Gitano-managed adapter files and clear Gitano preferences. It must not delete provider accounts, global npm caches outside Gitano's prefix, or provider tools installed outside Gitano.

### Do not hard-code provider-specific settings

The settings UI must continue to render `ExternalAiAgentSessionConfig.options` returned by the backend for the selected agent. Copilot, Codex, Gemini, and Claude may expose different config ids, names, values, descriptions, defaults, or no options at all.

Preference storage should remain keyed by agent id and config id:

```text
externalAgentOptionValues[agentId][configId]
actionExternalAgentOptionValues[actionKind][agentId][configId]
```

When applying options, the backend should continue to validate against the selected agent's current ACP response before calling `session/set_config_option` or legacy `session/set_mode`. Stored values that are absent for the selected agent should be ignored rather than shown as valid or failing the run.

Some agents expose permission-service options, such as Copilot's `allow_all`, that are intended for clients with Zed-style permission services. Gitano should hide and skip those options until it provides an equivalent permission service, because applying them can make the agent reject the session before the prompt starts.

Alternative considered: maintain a frontend map of known model selectors for Codex, Gemini, and Copilot. That would drift as agents change and would directly violate the user's requirement that the settings match each agent.

### Keep config loading scoped by selected agent id

The settings hook should keep config responses keyed by `agentId`. When the selected global or action engine changes, Gitano should request config for the newly selected external agent and render only that agent's response under that row. Cached config for another agent may remain in memory, but it must not be used for the current row.

Tests should cover at least two agents returning a `model` option with different values, then assert the UI displays only the selected agent's values and persists changes under the selected agent id.

### Copilot authentication metadata follows Copilot CLI

Expose GitHub-oriented authentication methods for the Copilot entry, such as a GitHub account login and token-based environment variables. This is metadata for the settings surface; Gitano should not invent credentials or ask for API keys that Copilot CLI does not use.

Adapter availability is not provider authentication. When Gitano can launch the adapter but cannot verify the Copilot account, the UI should show the adapter as installed rather than authenticated or ready. The status-refresh action may re-read backend status, but it must not imply that Gitano performed provider login unless the backend reports `authenticated: true`.

If future Copilot ACP responses expose richer auth status or methods, the backend can prefer agent-provided data. This change should keep the current curated metadata model.

### Treat invalid external output as a reportable run error

External agents can still ignore the JSON-only final-answer contract. When that happens, Gitano should fail the run with a reportable debug payload instead of treating the transcript as a successful analysis result. The payload should include the parse error, selected agent id/version, action kind, run refs or commit SHA, effective config values, and the final transcript.

If the transcript is itself an agent error, such as Copilot returning an authorization or policy failure, Gitano should report an external-agent runtime error and promote the agent's error message. This keeps real provider failures from being presented primarily as JSON parser failures.

If the transcript is only progress or planning text and contains no JSON object at all, Gitano should report that the external agent completed without returning a structured result. This keeps agent progress messages from being presented as JSON parser failures while preserving the transcript in the debug payload.

Copilot ACP can call its internal `report_intent` tool while planning work. Gitano should acknowledge that client request as progress instead of rejecting it as an unsupported ACP method, because rejecting it can cause Copilot to stop before it produces the required final JSON.

Copilot can also default ACP sessions into a plan-oriented mode depending on the user's CLI state. For Gitano's read-only analysis actions, the backend should prefer a non-plan Copilot mode when the agent exposes one and the user has not explicitly chosen a mode. If an external agent still ends an ACP turn without any JSON object, Gitano should send one corrective follow-up prompt in the same session requesting only the required JSON result. This preserves the standard ACP turn flow while giving agents that emitted only a plan/progress message one chance to finish the requested structured response.

The frontend should preserve that exact error string in the AI action state and global action log. Action surfaces and result modals should show a compact human-readable paragraph with "See log for more details" instead of rendering the full payload inline. For branch analysis/review, the compact error belongs beside the Analyze/Review buttons while copy/report paths and the global log retain the full debug payload.

The same compact-display rule should apply to every AI action surface, including commit analysis, branch analysis/review, and conflict suggestions, so the user sees the actionable paragraph in context and the full diagnostic data in the log.

## Risks / Trade-offs

- Copilot ACP support and registry package versions can change. Mitigation: keep command construction isolated in catalog metadata and follow the registry id/package/args shape.
- Desktop apps often start with a shorter PATH than an interactive shell. Mitigation: search common user and package-manager binary directories and pass that effective PATH to the child process.
- Gitano cannot guarantee provider authentication from adapter installation. Mitigation: keep status/auth metadata compact and rely on ACP startup/session errors for runtime failures.
- Gitano does not currently bundle Zed's NodeRuntime. Mitigation: resolve system npm across OS-specific paths and report a precise adapter-package error when npm is unavailable.
- Some agents may expose the same config id with incompatible values. Mitigation: persist by agent id and validate selected values against the selected agent's current options before applying.
- Config discovery starts an agent process, so adding another selected external agent can add latency in Settings. Mitigation: load only selected external agent configs and show row-level loading/error states.
