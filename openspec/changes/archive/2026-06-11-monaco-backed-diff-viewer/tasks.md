## 1. Monaco Diff Rendering Foundation

- [x] 1.1 Add shared Monaco language inference and reusable lazy editor loading helpers suitable for diff surfaces.
- [x] 1.2 Add diff-source mapping utilities that build Monaco model content from unified and split hunk rows while preserving `hunkIdx + lineIdx` identities.

## 2. Hunk Renderer Integration

- [x] 2.1 Render unified diff source content through read-only Monaco-backed surfaces while keeping existing React gutters, line numbers, staging handlers, and review accessories.
- [x] 2.2 Render split diff source content through read-only Monaco-backed side surfaces while preserving split-row pairing and center staging gutters.
- [x] 2.3 Apply row-level add/delete/context tones and exact inline changed-text decorations over Monaco content.
- [x] 2.4 Provide a plain React source fallback for unsupported languages or Monaco load failures.

## 3. Tests and Verification

- [x] 3.1 Add unit tests for language inference and diff-source mapping utilities.
- [x] 3.2 Update diff hunk tests for Monaco-backed unified/split rendering, inline highlights, staging gutters, and review/comment anchors.
- [x] 3.3 Run `pnpm run lint`, `pnpm test`, and `pnpm run build`.
