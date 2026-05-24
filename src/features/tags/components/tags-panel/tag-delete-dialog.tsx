import ReactDOM from "react-dom";
import { IconX } from "@/shared/components/icons/icons";
import type { DeleteDialogState, TagActionLoading } from "./types";
import { canDeleteLocalTag, canDeleteOriginTag } from "../../utils/tag-refs";

type TagDeleteDialogProps = {
  deleteDialog: DeleteDialogState | null;
  tagActionLoading: TagActionLoading | null;
  actionError: string | null;
  onDeleteOriginChange: (deleteOrigin: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TagDeleteDialog({
  deleteDialog,
  tagActionLoading,
  actionError,
  onDeleteOriginChange,
  onCancel,
  onConfirm,
}: TagDeleteDialogProps) {
  if (!deleteDialog) return null;

  const { tag } = deleteDialog;
  const hasLocal = canDeleteLocalTag(tag);
  const hasOrigin = canDeleteOriginTag(tag);
  const willDeleteOrigin = hasLocal ? deleteDialog.deleteOrigin : hasOrigin;
  const canConfirmDelete = (hasLocal || hasOrigin) && tagActionLoading === null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded border border-border bg-background-emphasis p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Delete tag</div>
            <div className="text-xs text-muted-foreground">{tag.name}</div>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close delete tag dialog"
            onClick={onCancel}
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="text-sm text-zinc-200">
          {hasLocal ? "Delete this local tag?" : "This tag exists only on origin. Delete it from origin?"}
        </div>
        {hasLocal && hasOrigin ? (
          <label className="mt-3 flex items-start gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border bg-background"
              checked={deleteDialog.deleteOrigin}
              disabled={tagActionLoading?.kind === "delete"}
              onChange={(event) => onDeleteOriginChange(event.target.checked)}
            />
            <span>
              Delete from origin too
              <span className="block text-xs text-muted-foreground">
                Remote deletion happens before local deletion.
              </span>
            </span>
          </label>
        ) : null}

        {actionError ? <div className="mt-2 text-xs text-red-400">{actionError}</div> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={tagActionLoading?.kind === "delete"}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded border border-red-500/60 bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-100 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canConfirmDelete}
            onClick={onConfirm}
          >
            {tagActionLoading?.kind === "delete"
              ? "Deleting..."
              : willDeleteOrigin
              ? "Delete from origin"
              : "Delete locally"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
