## Context

The workspace currently uses a shared zustand store (`useRemoteActionsStore`) to coordinate action loading state and snackbar feedback in the top toolbar and commit bar. While this store began as pull/push support, it now also carries stash/pop status, so naming is no longer accurate to actual scope. The immediate need is a terminology alignment that preserves behavior while clarifying intent.

## Goals / Non-Goals

**Goals:**
- Replace `remote`-scoped naming in shared action feedback state with neutral `git action` naming.
- Keep existing interaction and snackbar behavior unchanged.
- Keep the migration low-risk by limiting edits to naming and references.

**Non-Goals:**
- No redesign of snackbar UX, timing values, or visual styling.
- No backend git command changes.
- No expansion of which operations emit notices beyond current behavior.

## Decisions

1. Rename the shared state API to reflect actual scope.
- Decision: Rename store/entity naming from `remote` terms to `git action` terms (store file/module, selectors, setter names, local variables).
- Rationale: Current scope includes remote and non-remote actions; neutral naming avoids semantic drift.
- Alternative considered: Keep existing names and document the mismatch. Rejected because it preserves ambiguity and ongoing cognitive overhead.

2. Update spec terminology in `toolbar-remote-actions` capability instead of creating a new capability.
- Decision: Modify existing capability requirement language from remote-only feedback to shared git-action feedback.
- Rationale: This is an evolution of existing behavior contract, not a separate product domain.
- Alternative considered: Create a separate capability for naming cleanup. Rejected because the behavior contract already lives in `toolbar-remote-actions`.

3. Preserve compatibility by making this a no-behavior-change refactor.
- Decision: Keep all snackbar semantics (success/error handling, details expansion, auto-dismiss timing split).
- Rationale: The change is primarily semantic and maintainability-oriented; behavior changes would add unnecessary risk.
- Alternative considered: Adjust snackbar logic during rename. Rejected to keep rollout scope small and testable.

## Risks / Trade-offs

- [Risk] Incomplete rename leaves mixed terminology across files. -> Mitigation: Centralized search for `remoteNotice`, `setRemoteNotice`, `useRemoteActionsStore`, and related store API names.
- [Risk] Renaming store module can break imports. -> Mitigation: Update all import paths/usages in one pass and run typecheck/build.
- [Trade-off] Existing capability folder name (`toolbar-remote-actions`) remains for continuity. -> Mitigation: Clarify in requirements that feedback scope covers all supported git actions using shared status channels.
