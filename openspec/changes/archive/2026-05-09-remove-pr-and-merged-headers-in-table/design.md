## Context

The commit list flow currently carries `pr`, `merged_in`, and `ci` from the Tauri payload into the frontend `CommitList` table even though that functionality does not work yet and the backend currently sets those values to `None`. That means the codebase still contains dead fields in the Rust types, the payload assembly, the TypeScript types, and the visible column definitions in `src/components/CommitList.tsx`. The table component itself is generic and does not encode commit-specific column behavior.

## Goals / Non-Goals

**Goals:**
- Stop rendering the `PR` and `Mergeado en` columns in the commit list table.
- Stop rendering the `CI` column in the commit list table.
- Remove `pr`, `merged_in`, and `ci` from the commit list data model on both the frontend and Tauri side.
- Preserve all existing commit list behaviors outside of those removed fields, including loading, virtualization, row selection, and keyboard navigation.

**Non-Goals:**
- Implementing working PR, merge-target, or CI detection as part of this change.
- Redesigning the generic table component or adding column-visibility preferences.
- Changing unrelated commit list fields or behaviors beyond removal of the incomplete `pr`, `merged_in`, and `ci` path.

## Decisions

Remove the two columns by editing the `columns` array in `CommitList` rather than adding hide flags or table-level filtering. This remains the correct frontend approach because the current component already owns the commit-specific column definition and the generic table simply renders whatever columns it receives.

Remove the underlying `CommitListItem` fields from both TypeScript and Rust as part of the same change. The backend currently hardcodes all three values to `None`, so keeping them in the payload only preserves dead contract surface and increases the chance that unfinished functionality leaks back into the UI.

Update the Tauri payload assembly in `src-tauri/src/git/commits.rs` so it no longer defines or serializes `pr`, `merged_in`, or `ci`. This keeps the transport contract aligned with the UI and avoids carrying non-functional placeholders through the stack.

Avoid changing widths or labels of neighboring columns unless layout regression requires it. The primary requirement is removal of the incomplete fields, not a broader table redesign.

## Risks / Trade-offs

- [Frontend and backend types may drift during the removal] -> Update the Rust and TypeScript `CommitListItem` definitions together and verify the command payload still deserializes cleanly.
- [Table spacing changes after column removal] -> Verify the remaining columns still render cleanly and adjust widths only if the table becomes visually imbalanced.
- [Future PR, merge-target, or CI work will need to reintroduce these fields] -> Accept this trade-off because removing dead paths now is better than keeping a broken feature surface in place.
