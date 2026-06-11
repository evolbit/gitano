import {
  IconCheck,
  IconRefresh,
  IconSparkles,
  IconX,
} from "@/shared/components/icons/icons";
import type { ConflictAiPanelProps } from "./types";

function aiButtonClass(disabled = false) {
  return `inline-flex h-8 items-center gap-1.5 rounded border border-border px-2 text-xs font-medium transition-colors ${
    disabled
      ? "cursor-not-allowed text-zinc-600"
      : "text-zinc-200 hover:bg-background-emphasis"
  }`;
}

export function ConflictAiPanel({
  candidate,
  candidateSummary,
  loading,
  error,
  canRunRegion,
  canRunFile,
  onRunRegion,
  onRunFile,
  onRefreshRegion,
  onRefreshFile,
  onApply,
  onClear,
}: ConflictAiPanelProps) {
  const regionDisabled = loading || !canRunRegion;
  const fileDisabled = loading || !canRunFile;

  return (
    <section className="min-w-0 overflow-hidden border-t border-border bg-zinc-950/50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <IconSparkles size={14} />
            AI Fix
          </div>
          {candidateSummary ? (
            <div className="mt-0.5 truncate text-[11px] text-zinc-400">
              {candidateSummary}
            </div>
          ) : null}
        </div>

        {candidate ? (
          <>
            <button
              type="button"
              className={aiButtonClass(loading)}
              disabled={loading}
              onClick={onApply}
            >
              <IconCheck size={14} />
              Apply
            </button>
            <button
              type="button"
              className={aiButtonClass(loading)}
              disabled={loading}
              onClick={onClear}
              aria-label="Dismiss AI candidate"
              title="Dismiss AI candidate"
            >
              <IconX size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={aiButtonClass(regionDisabled)}
              disabled={regionDisabled}
              onClick={onRunRegion}
            >
              Region
            </button>
            <button
              type="button"
              className={aiButtonClass(fileDisabled)}
              disabled={fileDisabled}
              onClick={onRunFile}
            >
              File
            </button>
          </>
        )}

        <button
          type="button"
          className={aiButtonClass(loading || (!canRunRegion && !canRunFile))}
          disabled={loading || (!canRunRegion && !canRunFile)}
          onClick={canRunRegion ? onRefreshRegion : onRefreshFile}
          aria-label="Rerun AI fix"
          title="Rerun AI fix"
        >
          <IconRefresh size={14} />
        </button>
      </div>

      {loading ? (
        <div className="mt-2 text-xs text-zinc-400">Generating AI fix</div>
      ) : null}
      {error ? (
        <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-100">
          {error}
        </div>
      ) : null}
    </section>
  );
}
