import ReactDOM from "react-dom";
import { IconX } from "@/shared/components/icons/icons";
import { classNames } from "@/shared/ui";
import type { TagNameAvailability } from "@/shared/types/git";
import type { RenameDialogState, TagActionLoading } from "./types";

type TagRenameDialogProps = {
  renameDialog: RenameDialogState | null;
  renameAvailability: TagNameAvailability | null;
  renameChecking: boolean;
  tagActionLoading: TagActionLoading | null;
  actionError: string | null;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TagRenameDialog({
  renameDialog,
  renameAvailability,
  renameChecking,
  tagActionLoading,
  actionError,
  onValueChange,
  onCancel,
  onConfirm,
}: TagRenameDialogProps) {
  if (!renameDialog) return null;

  const nextName = renameDialog.value.trim();
  const unchanged = nextName === renameDialog.tag.name;
  const validName = renameAvailability?.validName ?? false;
  const localExists = renameAvailability?.localExists ?? false;
  const originExists = renameAvailability?.originExists === true;
  const originUnavailable =
    renameAvailability?.originExists === null && renameAvailability.originAvailable === false;
  const hasBlockingRenameError = Boolean(
    renameAvailability && (!validName || localExists || originExists),
  );
  const canConfirmRename = Boolean(
    nextName &&
      !unchanged &&
      !renameChecking &&
      renameAvailability &&
      validName &&
      !localExists &&
      !originExists &&
      tagActionLoading === null,
  );
  const validationMessage = getRenameValidationMessage({
    nextName,
    unchanged,
    renameChecking,
    renameAvailability,
    validName,
    localExists,
    originExists,
    originUnavailable,
  });

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded border border-border bg-background-emphasis p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Rename local tag</div>
            <div className="text-xs text-muted-foreground">{renameDialog.tag.name}</div>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close rename tag dialog"
            onClick={onCancel}
          >
            <IconX size={16} />
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-300">New tag name</span>
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            value={renameDialog.value}
            autoFocus
            disabled={tagActionLoading?.kind === "rename"}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfirmRename) {
                onConfirm();
              }
            }}
          />
        </label>

        <div
          className={classNames(
            "mt-2 text-xs",
            originUnavailable ? "text-amber-300" : "text-muted-foreground",
            hasBlockingRenameError ? "text-red-400" : "",
          )}
        >
          {validationMessage}
        </div>

        {actionError ? <div className="mt-2 text-xs text-red-400">{actionError}</div> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={tagActionLoading?.kind === "rename"}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded border border-blue-500/60 bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-100 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canConfirmRename}
            onClick={onConfirm}
          >
            {tagActionLoading?.kind === "rename" ? "Renaming..." : "Rename locally"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function getRenameValidationMessage({
  nextName,
  unchanged,
  renameChecking,
  renameAvailability,
  validName,
  localExists,
  originExists,
  originUnavailable,
}: {
  nextName: string;
  unchanged: boolean;
  renameChecking: boolean;
  renameAvailability: TagNameAvailability | null;
  validName: boolean;
  localExists: boolean;
  originExists: boolean;
  originUnavailable: boolean;
}) {
  if (!nextName) return "Tag name is required.";
  if (unchanged) return "Choose a different tag name.";
  if (renameChecking) return "Checking origin...";
  if (!renameAvailability) return "Waiting for validation...";
  if (!validName) return "Invalid tag name.";
  if (localExists) return "A local tag with this name already exists.";
  if (originExists) return "A tag with this name already exists on origin.";
  if (originUnavailable) {
    return "Could not check origin. Rename will stay local; pushing may fail later if the tag already exists on origin.";
  }
  return "Rename only changes the local tag. Push the renamed tag explicitly afterward.";
}
