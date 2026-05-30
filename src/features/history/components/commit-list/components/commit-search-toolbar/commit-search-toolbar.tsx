import { Tooltip } from "@mantine/core";
import { IconChevronRight, IconSearch } from "@/shared/components/icons/icons";

type CommitSearchToolbarProps = {
  currentMatchPosition: number;
  matchedCount: number;
  nextShortcut: string;
  onNavigate: (direction: 1 | -1) => void;
  onSearchChange: (value: string) => void;
  prevShortcut: string;
  search: string;
};

export function CommitSearchToolbar({
  currentMatchPosition,
  matchedCount,
  nextShortcut,
  onNavigate,
  onSearchChange,
  prevShortcut,
  search,
}: CommitSearchToolbarProps) {
  return (
    <div className="flex items-center gap-2 pb-4">
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onNavigate(1);
            }
          }}
          placeholder="Search commits..."
          className="h-8 w-full rounded border border-border bg-background px-3 pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <IconSearch className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Tooltip
          label={
            <div className="flex min-w-[230px] items-center justify-between gap-6">
              <span>Select Previous Match</span>
              <span className="font-medium text-zinc-300">{prevShortcut}</span>
            </div>
          }
        >
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary text-zinc-400 transition-colors hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onNavigate(-1)}
            disabled={!matchedCount}
          >
            <IconChevronRight size={14} className="rotate-180" />
          </button>
        </Tooltip>
        <Tooltip
          label={
            <div className="flex min-w-[210px] items-center justify-between gap-6">
              <span>Select Next Match</span>
              <span className="font-medium text-zinc-300">{nextShortcut}</span>
            </div>
          }
        >
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary text-zinc-400 transition-colors hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onNavigate(1)}
            disabled={!matchedCount}
          >
            <IconChevronRight size={14} />
          </button>
        </Tooltip>
        <span className="min-w-[56px] text-center text-zinc-300">
          {matchedCount
            ? `${currentMatchPosition >= 0 ? currentMatchPosition + 1 : 0}/${matchedCount}`
            : "0/0"}
        </span>
      </div>
    </div>
  );
}
