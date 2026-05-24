import {
  type Dispatch,
  type SetStateAction,
} from "react";
import { ConfirmModal } from "@/shared/components/confirm-modal/confirm-modal";
import { buildDefaultWorktreeFolder } from "@/features/worktrees";
import type { CommitDialogState } from "../../../../types/commit-list";

export type { CommitDialogState } from "../../../../types/commit-list";

const COMMIT_DIALOG_COPY: Record<
  CommitDialogState["kind"],
  { title: string; confirmLabel: string; loadingLabel: string }
> = {
  branch: {
    title: "Create Branch From Commit",
    confirmLabel: "Create Branch",
    loadingLabel: "Creating...",
  },
  tag: {
    title: "Create Tag At Commit",
    confirmLabel: "Create Tag",
    loadingLabel: "Creating...",
  },
  worktree: {
    title: "Create Worktree From Commit",
    confirmLabel: "Create Worktree",
    loadingLabel: "Creating...",
  },
  cherryPick: {
    title: "Cherry-pick Commit",
    confirmLabel: "Cherry-pick Commit",
    loadingLabel: "Cherry-picking...",
  },
  revert: {
    title: "Revert Commit",
    confirmLabel: "Revert Commit",
    loadingLabel: "Reverting...",
  },
};

const COMMIT_DIALOG_INPUT_CLASS =
  "h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-blue-500/60";
const COMMIT_DIALOG_TEXTAREA_CLASS =
  "min-h-20 w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500/60";

export function commitActionFailureTitle(kind: CommitDialogState["kind"]) {
  switch (kind) {
    case "cherryPick":
      return "Cherry-pick failed";
    case "revert":
      return "Revert failed";
    default:
      return "Commit action failed";
  }
}

export function isBranchMutationDialog(kind: CommitDialogState["kind"]) {
  return kind === "cherryPick" || kind === "revert";
}

function commitDialogConfirmDisabled(
  dialog: CommitDialogState | null,
  branchName: string,
  tagName: string,
  worktreeBranch: string,
  worktreePath: string,
) {
  if (!dialog) return true;

  switch (dialog.kind) {
    case "branch":
      return !branchName.trim();
    case "tag":
      return !tagName.trim();
    case "worktree":
      return !worktreeBranch.trim() || !worktreePath.trim();
    default:
      return false;
  }
}

function commitDialogDescription(
  dialog: CommitDialogState | null,
  dialogConfirmLabel: string,
  selectedBranch: string | null | undefined,
  dialogCommitLabel: string,
) {
  if (!dialog) return null;

  const actionLabel = isBranchMutationDialog(dialog.kind)
    ? `${dialogConfirmLabel} on ${selectedBranch ?? "current branch"}`
    : dialogConfirmLabel;

  return (
    <span>
      {actionLabel}{" "}
      <span className="font-mono text-blue-200">{dialogCommitLabel}</span>
    </span>
  );
}

function CommitDialogDetails({
  dialog,
  dialogLoading,
  dialogError,
  branchName,
  setBranchName,
  tagName,
  setTagName,
  tagAnnotated,
  setTagAnnotated,
  tagDescription,
  setTagDescription,
  worktreeBranch,
  setWorktreeBranch,
  worktreePath,
  setWorktreePath,
  repoPath,
}: {
  dialog: CommitDialogState | null;
  dialogLoading: boolean;
  dialogError: string | null;
  branchName: string;
  setBranchName: Dispatch<SetStateAction<string>>;
  tagName: string;
  setTagName: Dispatch<SetStateAction<string>>;
  tagAnnotated: boolean;
  setTagAnnotated: Dispatch<SetStateAction<boolean>>;
  tagDescription: string;
  setTagDescription: Dispatch<SetStateAction<string>>;
  worktreeBranch: string;
  setWorktreeBranch: Dispatch<SetStateAction<string>>;
  worktreePath: string;
  setWorktreePath: Dispatch<SetStateAction<string>>;
  repoPath?: string | null;
}) {
  if (!dialog) return null;

  return (
    <div className="space-y-3">
      {dialog.kind === "branch" ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-300">
            Branch name
          </span>
          <input
            type="text"
            className={COMMIT_DIALOG_INPUT_CLASS}
            value={branchName}
            disabled={dialogLoading}
            onChange={(event) => setBranchName(event.target.value)}
            autoFocus
          />
        </label>
      ) : null}
      {dialog.kind === "tag" ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-300">
              Tag name
            </span>
            <input
              type="text"
              className={COMMIT_DIALOG_INPUT_CLASS}
              value={tagName}
              disabled={dialogLoading}
              onChange={(event) => setTagName(event.target.value)}
              autoFocus
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border bg-background"
              checked={tagAnnotated}
              disabled={dialogLoading}
              onChange={(event) => setTagAnnotated(event.target.checked)}
            />
            Annotated tag
          </label>
          {tagAnnotated ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-300">
                Description
              </span>
              <textarea
                className={COMMIT_DIALOG_TEXTAREA_CLASS}
                value={tagDescription}
                disabled={dialogLoading}
                onChange={(event) => setTagDescription(event.target.value)}
              />
            </label>
          ) : null}
        </>
      ) : null}
      {dialog.kind === "worktree" ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-300">
              Branch
            </span>
            <input
              type="text"
              className={COMMIT_DIALOG_INPUT_CLASS}
              value={worktreeBranch}
              disabled={dialogLoading}
              onChange={(event) => {
                const nextBranch = event.target.value;
                setWorktreeBranch(nextBranch);
                if (repoPath) {
                  setWorktreePath(buildDefaultWorktreeFolder(repoPath, nextBranch));
                }
              }}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-300">
              Path
            </span>
            <input
              type="text"
              className={COMMIT_DIALOG_INPUT_CLASS}
              value={worktreePath}
              disabled={dialogLoading}
              onChange={(event) => setWorktreePath(event.target.value)}
            />
          </label>
        </>
      ) : null}
      {isBranchMutationDialog(dialog.kind) ? (
        <span>
          This runs{" "}
          <span className="font-mono">
            git {dialog.kind === "cherryPick" ? "cherry-pick" : "revert"}
          </span>{" "}
          against the current branch. Git may stop for conflicts.
        </span>
      ) : null}
      {dialogError ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
          {dialogError}
        </div>
      ) : null}
    </div>
  );
}

export function CommitActionDialog({
  dialog,
  dialogLoading,
  dialogError,
  branchName,
  setBranchName,
  tagName,
  setTagName,
  tagAnnotated,
  setTagAnnotated,
  tagDescription,
  setTagDescription,
  worktreeBranch,
  setWorktreeBranch,
  worktreePath,
  setWorktreePath,
  repoPath,
  selectedBranch,
  onCancel,
  onConfirm,
}: {
  dialog: CommitDialogState | null;
  dialogLoading: boolean;
  dialogError: string | null;
  branchName: string;
  setBranchName: Dispatch<SetStateAction<string>>;
  tagName: string;
  setTagName: Dispatch<SetStateAction<string>>;
  tagAnnotated: boolean;
  setTagAnnotated: Dispatch<SetStateAction<boolean>>;
  tagDescription: string;
  setTagDescription: Dispatch<SetStateAction<string>>;
  worktreeBranch: string;
  setWorktreeBranch: Dispatch<SetStateAction<string>>;
  worktreePath: string;
  setWorktreePath: Dispatch<SetStateAction<string>>;
  repoPath?: string | null;
  selectedBranch?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogCopy = dialog ? COMMIT_DIALOG_COPY[dialog.kind] : null;
  const dialogTitle = dialogCopy?.title ?? "";
  const dialogConfirmLabel = dialogCopy?.confirmLabel ?? "Confirm";
  const dialogLoadingLabel = dialogCopy?.loadingLabel ?? "Working...";
  const dialogCommitLabel = dialog
    ? `${dialog.commit.sha.slice(0, 7)} · ${dialog.commit.message || "Untitled commit"}`
    : "";

  return (
    <ConfirmModal
      open={dialog !== null}
      title={dialogTitle}
      description={commitDialogDescription(
        dialog,
        dialogConfirmLabel,
        selectedBranch,
        dialogCommitLabel,
      )}
      details={
        <CommitDialogDetails
          dialog={dialog}
          dialogLoading={dialogLoading}
          dialogError={dialogError}
          branchName={branchName}
          setBranchName={setBranchName}
          tagName={tagName}
          setTagName={setTagName}
          tagAnnotated={tagAnnotated}
          setTagAnnotated={setTagAnnotated}
          tagDescription={tagDescription}
          setTagDescription={setTagDescription}
          worktreeBranch={worktreeBranch}
          setWorktreeBranch={setWorktreeBranch}
          worktreePath={worktreePath}
          setWorktreePath={setWorktreePath}
          repoPath={repoPath}
        />
      }
      confirmLabel={dialogConfirmLabel}
      loadingLabel={dialogLoadingLabel}
      variant={dialog && isBranchMutationDialog(dialog.kind) ? "danger" : "default"}
      loading={dialogLoading}
      confirmDisabled={commitDialogConfirmDisabled(
        dialog,
        branchName,
        tagName,
        worktreeBranch,
        worktreePath,
      )}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
