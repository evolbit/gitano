import { IconCheck, IconChevronDown, IconSearch, IconX } from "@/shared/components/icons/icons";
import { classNames } from "@/shared/ui";
import type { TagCommitOption } from "@/shared/types/git";

type TagCreatePanelProps = {
  addPanelOpen: boolean;
  tagName: string;
  tagDescription: string;
  tagAnnotated: boolean;
  commitSearch: string;
  commitOptions: TagCommitOption[];
  selectedCommit: TagCommitOption | null;
  commitDropdownOpen: boolean;
  commitLoading: boolean;
  createLoading: boolean;
  createError: string | null;
  requiresInitialCommit: boolean;
  onTagNameChange: (value: string) => void;
  onTagDescriptionChange: (value: string) => void;
  onTagAnnotatedChange: (value: boolean) => void;
  onCommitSearchChange: (value: string) => void;
  onSelectedCommitChange: (commit: TagCommitOption) => void;
  onCommitDropdownOpenChange: (open: boolean | ((current: boolean) => boolean)) => void;
  onCreateTag: () => void;
  onClose: () => void;
};

export function TagCreatePanel({
  addPanelOpen,
  tagName,
  tagDescription,
  tagAnnotated,
  commitSearch,
  commitOptions,
  selectedCommit,
  commitDropdownOpen,
  commitLoading,
  createLoading,
  createError,
  requiresInitialCommit,
  onTagNameChange,
  onTagDescriptionChange,
  onTagAnnotatedChange,
  onCommitSearchChange,
  onSelectedCommitChange,
  onCommitDropdownOpenChange,
  onCreateTag,
  onClose,
}: TagCreatePanelProps) {
  if (!addPanelOpen) return null;

  const canCreateTag = Boolean(
    tagName.trim() && selectedCommit && !createLoading && !requiresInitialCommit,
  );

  return (
    <div className="flex-shrink-0 border-t border-border bg-background-emphasis p-3 shadow-[0_-12px_32px_rgba(0,0,0,0.24)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Add tag</div>
          <div className="text-xs text-muted-foreground">
            Create a local tag on a selected commit.
          </div>
        </div>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Close add tag panel"
          onClick={onClose}
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-300">Tag name</span>
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="v1.0.0"
            value={tagName}
            disabled={createLoading}
            onChange={(event) => onTagNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canCreateTag) {
                onCreateTag();
              }
            }}
          />
        </label>

        <CommitSelector
          commitSearch={commitSearch}
          commitOptions={commitOptions}
          selectedCommit={selectedCommit}
          commitDropdownOpen={commitDropdownOpen}
          commitLoading={commitLoading}
          createLoading={createLoading}
          onCommitSearchChange={onCommitSearchChange}
          onSelectedCommitChange={onSelectedCommitChange}
          onCommitDropdownOpenChange={onCommitDropdownOpenChange}
        />

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border bg-background"
            checked={tagAnnotated}
            disabled={createLoading}
            onChange={(event) => onTagAnnotatedChange(event.target.checked)}
          />
          Annotated tag
        </label>

        {tagAnnotated ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-300">
              Description <span className="text-muted-foreground">(optional)</span>
            </span>
            <textarea
              className="min-h-20 w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder="Release notes or tag details"
              value={tagDescription}
              disabled={createLoading}
              onChange={(event) => onTagDescriptionChange(event.target.value)}
            />
          </label>
        ) : null}

        {createError ? <div className="text-xs text-red-400">{createError}</div> : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createLoading}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded border border-blue-500/60 bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-100 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canCreateTag}
            onClick={onCreateTag}
          >
            {createLoading ? "Creating..." : "Create tag"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommitSelector({
  commitSearch,
  commitOptions,
  selectedCommit,
  commitDropdownOpen,
  commitLoading,
  createLoading,
  onCommitSearchChange,
  onSelectedCommitChange,
  onCommitDropdownOpenChange,
}: Pick<
  TagCreatePanelProps,
  | "commitSearch"
  | "commitOptions"
  | "selectedCommit"
  | "commitDropdownOpen"
  | "commitLoading"
  | "createLoading"
  | "onCommitSearchChange"
  | "onSelectedCommitChange"
  | "onCommitDropdownOpenChange"
>) {
  return (
    <div className="relative">
      <div className="mb-1 block text-xs font-medium text-zinc-300">Commit</div>
      <button
        type="button"
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={createLoading}
        onClick={() => onCommitDropdownOpenChange((open) => !open)}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedCommit ? (
            <>
              <span className="font-mono text-blue-300">{selectedCommit.shortSha}</span>
              <span className="text-muted-foreground"> · </span>
              {selectedCommit.message || "Untitled commit"}
            </>
          ) : commitLoading ? (
            "Loading commits..."
          ) : (
            "Select a commit"
          )}
        </span>
        <IconChevronDown size={16} className="flex-shrink-0 text-muted-foreground" />
      </button>

      {commitDropdownOpen ? (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded border border-border bg-background shadow-xl">
          <div className="relative border-b border-border p-2">
            <input
              type="text"
              className="w-full rounded border border-border bg-background-emphasis px-3 py-1.5 pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder="Search commits by SHA, message, or author..."
              value={commitSearch}
              onChange={(event) => onCommitSearchChange(event.target.value)}
              autoFocus
            />
            <IconSearch className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {commitLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
            ) : commitOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No commits found
              </div>
            ) : (
              commitOptions.map((commit) => (
                <CommitOption
                  key={commit.sha}
                  commit={commit}
                  selected={selectedCommit?.sha === commit.sha}
                  onSelect={() => {
                    onSelectedCommitChange(commit);
                    onCommitDropdownOpenChange(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommitOption({
  commit,
  selected,
  onSelect,
}: {
  commit: TagCommitOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={classNames(
        "flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-background-emphasis",
        selected ? "bg-blue-500/15 text-blue-100" : "text-foreground",
      )}
      onClick={onSelect}
    >
      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center text-blue-300">
        {selected ? <IconCheck size={14} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          <span className="font-mono text-blue-300">{commit.shortSha}</span>
          <span className="text-muted-foreground"> · </span>
          {commit.message || "Untitled commit"}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{commit.author}</span>
      </span>
    </button>
  );
}
