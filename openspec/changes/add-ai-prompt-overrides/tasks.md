## 1. Backend Preferences

- [x] 1.1 Add per-action prompt override fields to local AI preference types and persistence defaults.
- [x] 1.2 Add a backend command to set or clear an action prompt override.
- [x] 1.3 Expose the new preference field and command through the shared frontend local AI API.

## 2. Prompt Construction

- [x] 2.1 Define default action prompt instructions in a reusable backend structure.
- [x] 2.2 Apply prompt overrides to local model prompt construction while preserving Git context and JSON output constraints.
- [x] 2.3 Apply prompt overrides to external agent prompt construction while preserving read-only and output-shape constraints.
- [x] 2.4 Include the effective prompt instruction in cache key inputs for local and external AI actions.

## 3. Settings UI

- [x] 3.1 Add a Prompts section in the AI Configuration pane with controls for all Git AI actions.
- [x] 3.2 Let users save edited action prompts and show persisted values on reload.
- [x] 3.3 Add a `Use default value` control that clears an action override and restores the displayed default.

## 4. Verification

- [x] 4.1 Add backend tests for prompt override persistence, prompt composition, clearing, and cache separation.
- [x] 4.2 Add frontend tests for rendering prompt controls, saving an override, and using the default value.
- [x] 4.3 Run focused frontend and backend tests plus lint/build checks where practical.
