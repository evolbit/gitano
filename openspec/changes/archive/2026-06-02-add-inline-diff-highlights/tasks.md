## 1. Inline Range Calculation

- [x] 1.1 Add a typed utility that computes inline changed-text ranges for paired deleted/added lines inside existing changed blocks.
- [x] 1.2 Add utility tests for version-string replacements and unmatched changed lines.

## 2. Diff Renderer Integration

- [x] 2.1 Wire computed inline ranges into unified diff source rendering.
- [x] 2.2 Wire computed inline ranges into split diff source rendering.
- [x] 2.3 Add component tests proving darker red/green inline spans render without changing gutter/wrapping behavior.

## 3. Verification

- [x] 3.1 Run focused diff tests.
- [x] 3.2 Run frontend lint, full frontend tests, and production build.
