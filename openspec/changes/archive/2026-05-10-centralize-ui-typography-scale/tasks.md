## 1. Typography Tokens

- [x] 1.1 Add centralized UI typography size tokens for the main application UI.
- [x] 1.2 Keep the existing diff font-size token separate from the UI scale.

## 2. Surface Migration

- [x] 2.1 Migrate the main workflow UI surfaces to use the centralized UI size scale instead of scattered hardcoded defaults.
- [x] 2.2 Ensure Mantine-based controls and Tailwind-based text on the main workflow surfaces resolve consistently from the intended UI scale.
- [x] 2.3 Ensure hunk/code surfaces continue to use the separate diff font-size token.

## 3. Verification

- [x] 3.1 Verify the main app UI follows the centralized 16px-based sizing system.
- [x] 3.2 Verify hunks remain on their independent diff size.
- [x] 3.3 Verify future global UI size tuning can be done from a clear centralized place.
