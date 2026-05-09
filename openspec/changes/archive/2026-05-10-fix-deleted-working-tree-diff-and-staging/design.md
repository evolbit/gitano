## Context

The working-tree diff modal already reuses the shared changes explorer and editable diff viewer, but deleted files currently fall through a bad assumption in the diff-building layer: if the file no longer exists on disk, the backend returns no hunks. That makes the right pane show `No changes.` for deletions. At the same time, the staging UI treats deleted files like normal editable patches even though partial block and line staging is not a meaningful interaction for a file that no longer exists in the working tree.

## Goals / Non-Goals

**Goals:**
- Return deletion hunks for tracked working-tree files that have been deleted from disk.
- Keep deleted files visible and inspectable in the working-tree diff modal.
- Limit deleted-file staging controls to the file-level checkbox.
- Keep checked/unchecked file state correct for deleted files.

**Non-Goals:**
- Add partial staging support for deleted files.
- Change committed-file diff behavior.
- Introduce new staging APIs or a new backend staging model.

## Decisions

### Build synthetic deletion hunks for missing tracked working-tree files
The backend should not equate “file missing on disk” with “no diff.” For tracked files missing from the working tree, the diff layer should read the tracked content and synthesize a deletion hunk with `Del` lines, mirroring the deleted-file logic already used for commit diff rendering.

### Treat deleted working-tree files like file-level-only staging targets
Deleted files should remain stageable, but only through the file checkbox in the changes explorer. The editable diff viewer should not expose block or line staging controls for deleted files because there is no meaningful partial patch editing model for a missing working-tree file in this UI.

### Preserve existing staged-line storage for non-deleted files
This change should not redesign staging state. Non-deleted files continue to use the current staged-line model. Deleted files may still use the existing file-level state derivation path, but they should not expose per-block or per-line interactions.

## Risks / Trade-offs

- **[Risk] Deleted-file hunk synthesis diverges from real Git output** → Mitigation: mirror the existing commit-deletion hunk construction pattern and keep the representation minimal.
- **[Risk] File checkbox state still desynchronizes for deletions** → Mitigation: verify deleted-file checked state against the same source of truth used by the file-level staging interaction.
- **[Risk] Deleted-file UI rules become inconsistent with new files** → Mitigation: explicitly treat both as file-level-only staging cases, while still allowing deleted content to render in the diff pane.
