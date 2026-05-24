import { IconPlus, IconSearch } from "@/shared/components/icons/icons";

type TagsPanelToolbarProps = {
  search: string;
  requiresInitialCommit: boolean;
  onSearchChange: (search: string) => void;
  onAddTag: () => void;
};

export function TagsPanelToolbar({
  search,
  requiresInitialCommit,
  onSearchChange,
  onAddTag,
}: TagsPanelToolbarProps) {
  return (
    <div className="border-b border-border bg-background-emphasis p-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Search tags..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <button
          type="button"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-border bg-background text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={requiresInitialCommit}
          title={
            requiresInitialCommit
              ? "Create the initial commit before adding tags"
              : "Add tag"
          }
          aria-label="Add tag"
          onClick={onAddTag}
        >
          <IconPlus size={17} />
        </button>
      </div>
    </div>
  );
}
