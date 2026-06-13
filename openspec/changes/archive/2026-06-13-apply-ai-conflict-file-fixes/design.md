## Context

The merge editor already has a scoped conflict AI hook and a panel with `Region`, `File`, `Apply`, and dismiss controls. Backend AI execution already routes through the selected engine in settings, builds scoped conflict context, parses structured JSON, normalizes stale signatures, and returns either a region replacement or full-file candidate.

The current behavior is too indirect for the primary editor workflow: users must choose scope, wait for a candidate, then click Apply. It also does not carry structured region-decision metadata, so the UI cannot reliably explain which side was selected per conflict or update side-pane accepted state from a full-file AI result.

## Goals / Non-Goals

**Goals:**

- Make the merge editor AI Fix action file-scoped with a single `Resolve with AI` primary button.
- Apply valid file-scoped AI candidates directly to the result editor state.
- Return and preserve a brief summary, full details, and per-region AI decisions: region id, selected choice, and reason.
- Update accepted-region UI state from AI decisions so side panes reflect current/incoming choices where applicable.
- Show the brief applied AI summary in the result panel's bottom status message, with full reasoning hidden behind `View details`.
- Show AI Fix errors in the result panel's bottom status message, with error styling.
- Make settings render backend-provided default prompts instead of a frontend prompt copy.
- Improve the default merge-conflict prompt to prefer correctness, intent preservation, compatible combinations, and low invention over recency bias.
- Continue routing through the user-selected AI engine.

**Non-Goals:**

- Automatically marking a file resolved or staging it.
- Letting external agents modify repository files directly.
- Replacing manual side/region accept actions outside the AI Fix row.
- Inferring side choices by diffing generated content.

## Decisions

### Decision: File-scoped AI Fix is the merge editor default

The panel will expose one `Resolve with AI` action for supported text conflicts. Internally it calls the existing `mergeConflictSuggestions` action with a file scope, preserving engine selection, setup handling, cache behavior, and stale signature normalization. Conflict regions remain internal context for the model and structured output; the user does not choose a region.

Alternative considered: Keep `Region` and `File` but make `File` primary. This still leaves an unnecessary choice in the main path and does not satisfy the requested simpler action.

### Decision: Gitano applies candidates, AI engines do not write files

The AI engine returns a structured full-file candidate. The frontend validates candidate signatures against the loaded detail and applies it to the result editor state. Existing Save and Mark Resolved controls remain responsible for writing the worktree result and updating the Git index.

Alternative considered: Write the AI result to the worktree immediately. That would erase the accepted-region state after detail reload and make generated content easier to persist accidentally.

### Decision: Add explicit per-region decision metadata

File-scoped conflict candidates will include a brief `summary`, optional full `details`, and `decisions`, each with `regionId`, `selectedSide`, and `reason`. `selectedSide` is a semantic choice: `current`, `incoming`, `combination`, or `custom`. The UI maps current/incoming to side-pane state; combination/custom stay accepted but do not hide one side's action row. The result status line shows `summary`; `details` and decision-derived fallback text are available behind `View details`.

Alternative considered: Parse the summary text. That is fragile and would make the UI dependent on model prose instead of structured data.

### Decision: Prompt for best merge, not latest merge

The default prompt should not prefer the latest side. Git stage names do not reliably encode semantic freshness, and recency bias can discard important current-side edits. The prompt should ask for the minimal correct merge: preserve both compatible changes, choose one side only when it clearly preserves behavior, avoid inventing unrelated behavior, and explain uncertainty.

### Decision: Settings display backend-owned default prompts

The backend owns default action prompt text because it is also responsible for composing the prompt used for AI execution. Settings receives those defaults through the preferences payload and uses them for display, reset-to-default, and prompt draft initialization. The frontend does not maintain a separate hardcoded default prompt table.

## Risks / Trade-offs

- AI may omit a region decision -> The frontend will still apply the full-file candidate, mark unresolved regions complete, and fall back to the candidate summary for messaging.
- AI may label a custom merge as incoming/current incorrectly -> The prompt and structured output reduce this risk, but the result remains editable before save/resolve.
- Cached results generated under the old prompt shape could be stale -> Bump prompt versions.
- External agents may attempt write operations -> Keep read-only prompt constraints and apply only parsed structured output through Gitano.

## Migration Plan

1. Extend Rust and TypeScript candidate models with conflict decision metadata.
2. Update prompt output shape, parser, conflict file context, default prompt, and prompt versions.
3. Update the conflict result state hook to apply full-file AI content with decision-derived accepted-region state.
4. Simplify the AI panel to one file-scoped action and show a brief completion message with expandable details in the result panel status message.
5. Add focused frontend and Rust tests.

Rollback: restore the previous panel props and hook flow, keep ignored decision metadata harmless in parsed results if needed.

## Open Questions

None.
