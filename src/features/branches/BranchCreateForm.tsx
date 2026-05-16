import type { Dispatch, SetStateAction } from "react";
import { IconGitBranch } from "@/components/icons";
import type { BranchCreateFormState } from "./types";
import { buildBranchName } from "./utils";

type BranchCreateFormProps = {
  createForm: BranchCreateFormState;
  creatingBranch: boolean;
  createBranchError: string | null;
  onCreateFormChange: Dispatch<SetStateAction<BranchCreateFormState | null>>;
  onCreateBranch: () => void;
  onCancel: () => void;
};

export function BranchCreateForm({
  createForm,
  creatingBranch,
  createBranchError,
  onCreateFormChange,
  onCreateBranch,
  onCancel,
}: BranchCreateFormProps) {
  const branchName = buildBranchName(createForm.prefix, createForm.name);

  return (
    <div className="border-t border-border bg-background-emphasis p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
        <IconGitBranch size={15} className="text-blue-300" />
        <span className="min-w-0 truncate">
          New branch based on{" "}
          <span className="font-mono text-blue-200">{createForm.baseRef}</span>
        </span>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Branch name
        <div className="flex min-w-0">
          {createForm.prefix ? (
            <span className="flex h-8 max-w-[45%] items-center rounded-l border border-r-0 border-border bg-background px-2 font-mono text-sm text-zinc-400">
              <span className="truncate">{createForm.prefix}</span>
            </span>
          ) : null}
          <input
            type="text"
            autoFocus
            className={`h-8 min-w-0 flex-1 border border-border bg-background px-2 text-sm text-foreground focus:outline-none ${
              createForm.prefix ? "rounded-r" : "rounded"
            }`}
            value={createForm.name}
            onChange={(event) =>
              onCreateFormChange((current) =>
                current ? { ...current, name: event.target.value } : current,
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreateBranch();
              }
              if (event.key === "Escape") {
                onCancel();
              }
            }}
          />
        </div>
      </label>
      {branchName ? (
        <div className="mt-2 truncate text-xs text-muted-foreground">
          Full branch: <span className="font-mono text-zinc-200">{branchName}</span>
        </div>
      ) : null}
      {createBranchError ? (
        <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
          {createBranchError}
        </div>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="h-8 rounded border border-border bg-background px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
          onClick={onCancel}
          disabled={creatingBranch}
        >
          Cancel
        </button>
        <button
          type="button"
          className="h-8 rounded border border-blue-500/50 bg-blue-500/20 px-3 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCreateBranch}
          disabled={creatingBranch || !branchName}
        >
          {creatingBranch ? "Creating..." : "Create Branch"}
        </button>
      </div>
    </div>
  );
}
