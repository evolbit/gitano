import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconChevronDown,
  IconGitBranch,
  IconSearch,
} from "@/shared/components/icons/icons";
import type { BranchTargetOption } from "../../utils/branch-compare-utils";

type BranchCompareBranchDropdownProps = {
  selectedBranch: string | null;
  localBranches: string[];
  remoteBranches: string[];
  placeholder: string;
  loading: boolean;
  error: string | null;
  onSelectBranch: (branchName: string) => void;
};

type DropdownRow =
  | { kind: "section"; id: string; label: string }
  | { kind: "branch"; id: string; option: BranchTargetOption };

const ROW_HEIGHT = 34;

export function BranchCompareBranchDropdown({
  selectedBranch,
  localBranches,
  remoteBranches,
  placeholder,
  loading,
  error,
  onSelectBranch,
}: BranchCompareBranchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const listRef = useRef<HTMLDivElement>(null);
  const normalizedSearch = deferredSearch.trim().toLowerCase();

  const rows = useMemo<DropdownRow[]>(() => {
    const matches = (branch: string) =>
      (!normalizedSearch || branch.toLowerCase().includes(normalizedSearch));
    const toBranchRows = (
      section: BranchTargetOption["section"],
      branches: string[],
    ): DropdownRow[] =>
      branches
        .filter(matches)
        .map((branch) => ({
          kind: "branch" as const,
          id: `${section}:${branch}`,
          option: { name: branch, section },
        }));
    const localRows = toBranchRows("local", localBranches);
    const remoteRows = toBranchRows("remote", remoteBranches);
    const nextRows: DropdownRow[] = [];

    if (localRows.length > 0) {
      nextRows.push({ kind: "section", id: "section:local", label: "Local" });
      nextRows.push(...localRows);
    }

    if (remoteRows.length > 0) {
      nextRows.push({ kind: "section", id: "section:remote", label: "Remote" });
      nextRows.push(...remoteRows);
    }

    return nextRows;
  }, [localBranches, normalizedSearch, remoteBranches]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const renderedRows =
    virtualRows.length > 0
      ? virtualRows
      : rows.slice(0, 20).map((_, index) => ({
          index,
          key: `fallback:${index}`,
          start: index * ROW_HEIGHT,
        }));

  return (
    <div className="relative min-w-[280px]">
      <button
        type="button"
        className="flex h-9 w-full min-w-0 items-center gap-2 rounded border border-border bg-background px-3 text-left text-sm text-zinc-200 transition-colors hover:bg-background-emphasis"
        onClick={() => setOpen((current) => !current)}
      >
        <IconGitBranch size={16} className="shrink-0 text-lime-400" />
        <span className="min-w-0 flex-1 truncate">
          {selectedBranch ?? placeholder}
        </span>
        <IconChevronDown size={16} className="shrink-0 text-zinc-500" />
      </button>

      {open ? (
        <div className="absolute left-0 top-10 z-[10020] w-[380px] overflow-hidden rounded border border-border bg-background-emphasis shadow-xl">
          <div className="border-b border-border bg-background p-2">
            <div className="relative">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoFocus
                placeholder="Search branches..."
                className="h-8 w-full rounded border border-border bg-background px-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <IconSearch className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Loading branches...
            </div>
          ) : error ? (
            <div className="px-3 py-2 text-sm text-red-300">{error}</div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matching branches
            </div>
          ) : (
            <div
              ref={listRef}
              className="max-h-[360px] overflow-y-auto overscroll-contain"
            >
              <div
                className="relative w-full"
                style={{ height: rowVirtualizer.getTotalSize() }}
              >
                {renderedRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) return null;

                  return (
                    <div
                      key={row.id}
                      className="absolute left-0 top-0 w-full"
                      style={{
                        height: ROW_HEIGHT,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.kind === "section" ? (
                        <div className="flex h-full items-center border-b border-border/40 px-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                          {row.label}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`flex h-full w-full min-w-0 items-center gap-2 px-3 text-left text-sm transition-colors hover:bg-zinc-800 ${
                            selectedBranch === row.option.name
                              ? "bg-blue-500/15 text-blue-100"
                              : "text-zinc-200"
                          }`}
                          onClick={() => {
                            onSelectBranch(row.option.name);
                            setOpen(false);
                          }}
                        >
                          <IconGitBranch
                            size={15}
                            className={
                              row.option.section === "local"
                                ? "shrink-0 text-lime-400"
                                : "shrink-0 text-blue-400"
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {row.option.name}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
