import type { BranchType } from "./types";
import {
  IconCloud,
  IconDeviceFloppy,
  IconPlus,
  IconSearch,
} from "@/components/icons";

type BranchListHeaderProps = {
  search: string;
  type: BranchType;
  onSearchChange: (search: string) => void;
  onTypeChange: (type: BranchType) => void;
  onCreateBranch: () => void;
  createDisabled?: boolean;
  createDisabledReason?: string;
};

export function BranchListHeader({
  search,
  type,
  onSearchChange,
  onTypeChange,
  onCreateBranch,
  createDisabled = false,
  createDisabledReason,
}: BranchListHeaderProps) {
  return (
    <div className="border-b border-border bg-background-emphasis p-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Search branches..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-center overflow-hidden rounded border border-border bg-background">
          <button
            type="button"
            className={`flex h-8 w-8 items-center justify-center transition-colors ${
              type === "local"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
            onClick={() => onTypeChange("local")}
            title="Local branches"
            aria-label="Local branches"
          >
            <IconDeviceFloppy size={15} />
          </button>
          <button
            type="button"
            className={`flex h-8 w-8 items-center justify-center transition-colors ${
              type === "remote"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
            onClick={() => onTypeChange("remote")}
            title="Remote branches"
            aria-label="Remote branches"
          >
            <IconCloud size={15} />
          </button>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCreateBranch}
          disabled={createDisabled}
          title={createDisabled ? createDisabledReason : "Add branch"}
          aria-label="Add branch"
        >
          <IconPlus size={16} />
        </button>
      </div>
    </div>
  );
}
