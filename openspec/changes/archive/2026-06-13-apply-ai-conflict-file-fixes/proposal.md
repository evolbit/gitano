## Why

The merge editor's AI Fix panel currently asks users to choose between region and file scopes, then returns a candidate that requires a second apply action. For the main merge-editor workflow, AI should act on the selected conflicted file directly, apply the validated result immediately, and explain which side or combination it selected per region.

## What Changes

- Replace the `Region` / `File` AI Fix choice with one `Resolve with AI` file-scoped action for supported text conflicts.
- Apply the returned file candidate to the result editor immediately after stale-state validation, while preserving the existing Save and Mark Resolved controls.
- Extend merge-conflict AI candidate output with per-region decisions containing region id, selected side/choice, and reason.
- Extend merge-conflict AI candidate output with separate brief summary and full details fields.
- Update side/result accepted-region UI state from AI decisions so the top panes reflect the AI-selected side where applicable.
- Show the applied AI brief summary in the result panel's bottom status message, with full reasoning behind `View details`.
- Show AI Fix failures in the result panel's bottom status message instead of in the AI Fix row.
- Use backend-provided default action prompt text in settings so the visible default prompt matches the prompt used by AI execution.
- Improve the default merge-conflict AI prompt so it asks for a conservative, correctness-focused merge rather than a generic suggestion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-ai-git-analysis`: File-scoped merge-conflict AI returns structured region decisions and can be applied immediately by Gitano after validation.
- `merge-conflict-resolution`: The merge editor exposes one file-level AI Fix action and displays the applied AI decision summary.

## Impact

- Working changes conflict resolution frontend: AI panel, conflict AI hook, result state hook, and colocated tests.
- Shared conflict AI candidate types in TypeScript.
- Tauri AI result types, prompt builders/parser, conflict context, prompt versions, and Rust tests.
- Existing AI provider selection is reused; no new AI engine configuration is introduced.
