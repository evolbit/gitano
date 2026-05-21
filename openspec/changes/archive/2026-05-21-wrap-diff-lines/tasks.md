## 1. Diff Row Wrapping

- [x] 1.1 Update unified diff source content so long lines use preserved-whitespace wrapping and break long tokens inside the code column.
- [x] 1.2 Update split diff source cells so each side wraps within its `minmax(0, 1fr)` pane while center gutters and line-number gutters stay fixed.
- [x] 1.3 Update split context rows to use the same wrapping behavior as split diff source cells.
- [x] 1.4 Stop reserving unified staging gutter columns in read-only diff surfaces.

## 2. Verification

- [x] 2.1 Replace non-wrapping diff hunk tests with assertions for wrapped source content in unified and split modes.
- [x] 2.2 Add or update coverage for long unbroken tokens so they cannot force horizontal overflow.
- [x] 2.3 Run the focused diff hunk tests and the relevant frontend test command.
