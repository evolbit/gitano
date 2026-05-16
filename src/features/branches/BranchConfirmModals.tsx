import { ConfirmModal } from "@/components/confirm-modal/ConfirmModal";
import { BranchName } from "./BranchName";
import type { BranchContextRequest } from "./types";

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
        title="Delete Branch"
        description={
          deleteRequest ? (
            <span>
              Delete <BranchName>{deleteRequest.branchName}</BranchName>?
            </span>
          ) : null
        }
        details={
          deleteRequest ? (
            <span>
              This runs <span className="font-mono">git branch -d</span>. Git
              will refuse if the branch is checked out or not fully merged.
            </span>
          ) : null
        }
        confirmLabel="Delete Branch"
        variant="danger"
        loading={branchActionLoading}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
