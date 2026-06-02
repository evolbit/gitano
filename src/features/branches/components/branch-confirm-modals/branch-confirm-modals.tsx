import { ConfirmModal } from "@/shared/components/confirm-modal/confirm-modal";
import { BranchName } from "../branch-name/branch-name";
import type { BranchContextRequest } from "../../types";

type BranchConfirmModalsProps = {
  renameRequest: BranchContextRequest | null;
  renameBranchName: string;
  deleteRequest: BranchContextRequest | null;
  branchActionLoading: boolean;
  onRenameNameChange: (value: string) => void;
  onCancelRename: () => void;
  onConfirmRename: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
};

export function BranchConfirmModals({
  renameRequest,
  renameBranchName,
  deleteRequest,
  branchActionLoading,
  onRenameNameChange,
  onCancelRename,
  onConfirmRename,
  onCancelDelete,
  onConfirmDelete,
}: BranchConfirmModalsProps) {
  const deleteTitle = deleteRequest?.remote
    ? "Delete " + deleteRequest.branchName
    : deleteRequest?.force
    ? "Delete " + deleteRequest.branchName + " (force)"
    : "Delete Branch";

  return (
    <>
      <ConfirmModal
        open={renameRequest !== null}
        title="Rename Branch"
        description={
          renameRequest ? (
            <span>
              Rename <BranchName>{renameRequest.branchName}</BranchName>
            </span>
          ) : null
        }
        details={
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-400">
              New branch name
            </span>
            <input
              value={renameBranchName}
              onChange={(event) => onRenameNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onConfirmRename();
                }
              }}
              className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
              autoFocus
            />
          </label>
        }
        confirmLabel="Rename Branch"
        loadingLabel="Renaming..."
        loading={branchActionLoading}
        confirmDisabled={
          !renameBranchName.trim() ||
          renameBranchName.trim() === renameRequest?.branchName
        }
        onCancel={onCancelRename}
        onConfirm={onConfirmRename}
      />

      <ConfirmModal
        open={deleteRequest !== null}
        title={deleteTitle}
        description={
          deleteRequest ? (
            <span>
              {deleteRequest.force ? "Force delete" : "Delete"}{" "}
              <BranchName>{deleteRequest.branchName}</BranchName>?
            </span>
          ) : null
        }
        details={
          deleteRequest ? (
            <span>
              This runs{" "}
              <span className="font-mono">
                {deleteRequest.remote
                  ? "git push origin --delete"
                  : `git branch ${deleteRequest.force ? "-D" : "-d"}`}
              </span>
              .{" "}
              {deleteRequest.remote
                ? "The branch will be deleted from origin. Local branches with the same name will not be deleted."
                : deleteRequest.force
                ? "Git will delete the branch even when it is not fully merged, but it will still refuse if the branch is checked out."
                : "Git will refuse if the branch is checked out or not fully merged."}
            </span>
          ) : null
        }
        confirmLabel={
          deleteRequest?.remote
            ? "Delete Remote Branch"
            : deleteRequest?.force
              ? "Force Delete Branch"
              : "Delete Branch"
        }
        loadingLabel={
          deleteRequest?.remote
            ? "Deleting remote branch..."
            : deleteRequest?.force
              ? "Force deleting..."
              : "Deleting..."
        }
        variant="danger"
        loading={branchActionLoading}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
