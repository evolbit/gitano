## 1. Commit Table Update

- [x] 1.1 Remove the `pr` and `merged_in` column definitions from the `columns` array in `src/components/CommitList.tsx`.
- [x] 1.2 Remove `pr` and `merged_in` from the shared commit list types in `src/types/git.ts` and `src-tauri/src/git/types.rs`.
- [x] 1.3 Remove the `ci` column definition from the `columns` array in `src/components/CommitList.tsx`.
- [x] 1.4 Remove `ci` from the shared commit list types in `src/types/git.ts` and `src-tauri/src/git/types.rs`.

## 2. Backend Payload Cleanup

- [x] 2.1 Remove `pr` and `merged_in` from commit list payload construction in `src-tauri/src/git/commits.rs`.
- [x] 2.2 Remove any now-unused frontend or backend code paths tied only to those two fields.
- [x] 2.3 Remove `ci` from commit list payload construction in `src-tauri/src/git/commits.rs`.
- [x] 2.4 Remove any now-unused frontend or backend code paths tied only to the commit list `ci` field.

## 3. Regression Verification

- [x] 3.1 Verify the remaining commit table columns still render in the intended order and remain readable after the width change caused by removing the incomplete columns.
- [x] 3.2 Confirm commit list row selection, keyboard navigation, and infinite scrolling still work after the field removal.
