import {
  IconRefresh,
  IconSparkles,
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
  loading,
  canRunFile,
  onRunFile,
  onRefreshFile,
}: ConflictAiPanelProps) {
  const fileDisabled = loading || !canRunFile;

  return (
    <section className="min-w-0 overflow-hidden border-t border-border bg-zinc-950/50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <IconSparkles size={14} />
            AI Fix
          </div>
        </div>

        <button
          type="button"
          className={aiButtonClass(fileDisabled)}
          disabled={fileDisabled}
          onClick={onRunFile}
        >
          {loading ? (
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"
            />
          ) : (
            <IconSparkles size={14} />
          )}
          {loading ? "Resolving" : "Resolve with AI"}
        </button>

        <button
          type="button"
          className={aiButtonClass(fileDisabled)}
          disabled={fileDisabled}
          onClick={onRefreshFile}
          aria-label="Rerun AI fix"
          title="Rerun AI fix"
        >
          <IconRefresh size={14} />
        </button>
      </div>

    </section>
  );
}
